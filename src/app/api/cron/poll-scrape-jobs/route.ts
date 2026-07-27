import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apifyClient, INSTAGRAM_SCRAPER_ACTOR_ID, APIFY_INSTAGRAM_CENTS_PER_RESULT } from "@/lib/apify";
import { ContentFormat } from "@/generated/prisma/client";

export const maxDuration = 60;

const FINISHED_FAILURE_STATUSES = new Set(["FAILED", "ABORTED", "TIMED-OUT", "TIMING-OUT", "ABORTING"]);

// Mapeia o "type"/"productType" retornados pelo apify/instagram-scraper para o enum
// ContentFormat do nosso schema.
function mapFormat(item: Record<string, unknown>): ContentFormat {
  if (item.type === "Sidecar") return ContentFormat.CAROUSEL;
  if (item.type === "Video") {
    return item.productType === "clips" ? ContentFormat.VIDEO_SHORT : ContentFormat.VIDEO_LONG;
  }
  return ContentFormat.IMAGE;
}

/// Endpoint chamado periodicamente (Vercel Cron) para verificar o status dos runs
/// da Apify iniciados via triggerScrapeAction, e ingerir os resultados quando prontos.
/// Protegido por CRON_SECRET (header Authorization: Bearer <CRON_SECRET>).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const runningJobs = await prisma.scrapeJob.findMany({
    where: { status: "RUNNING" },
    include: { referenceProfile: true },
  });

  const results: Array<{ jobId: string; status: string; postsCollected?: number; error?: string }> = [];

  for (const job of runningJobs) {
    if (!job.apifyRunId) continue;

    try {
      const run = await apifyClient.run(job.apifyRunId).get();
      if (!run) continue;

      if (run.status === "SUCCEEDED") {
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

        const upsertedIds: string[] = [];
        for (const raw of items) {
          const item = raw as Record<string, unknown>;
          if (!item.id) continue;

          const likes = typeof item.likesCount === "number" ? Math.max(item.likesCount, 0) : 0;
          const comments = typeof item.commentsCount === "number" ? item.commentsCount : 0;
          const views =
            typeof item.videoViewCount === "number"
              ? item.videoViewCount
              : typeof item.videoPlayCount === "number"
                ? item.videoPlayCount
                : null;

          const post = await prisma.contentPost.upsert({
            where: {
              network_externalId: { network: "INSTAGRAM", externalId: String(item.id) },
            },
            create: {
              organizationId: job.referenceProfile.organizationId,
              referenceProfileId: job.referenceProfile.id,
              network: "INSTAGRAM",
              externalId: String(item.id),
              authorHandle: (item.ownerUsername as string) ?? job.referenceProfile.handle,
              caption: (item.caption as string) ?? null,
              mediaUrls: [item.displayUrl, item.videoUrl].filter(Boolean) as string[],
              permalink: (item.url as string) ?? null,
              format: mapFormat(item),
              likes,
              comments,
              shares: 0,
              views,
              publishedAt: item.timestamp ? new Date(item.timestamp as string) : null,
            },
            update: { likes, comments, views, permalink: (item.url as string) ?? undefined },
          });
          upsertedIds.push(post.id);
        }

        // A busca por "posts" não traz o número de seguidores do perfil — fazemos uma
        // chamada complementar (resultsType "details", síncrona e rápida por ser um
        // único perfil) para popular authorFollowers/engagementRate. Não é crítico:
        // se falhar, o job de scraping em si ainda é considerado bem-sucedido.
        try {
          const detailsRun = await apifyClient.actor(INSTAGRAM_SCRAPER_ACTOR_ID).call({
            directUrls: [job.referenceProfile.url],
            resultsType: "details",
            resultsLimit: 1,
          });
          const { items: detailsItems } = await apifyClient
            .dataset(detailsRun.defaultDatasetId)
            .listItems();
          const followers = (detailsItems[0] as Record<string, unknown> | undefined)
            ?.followersCount as number | undefined;

          if (followers && followers > 0 && upsertedIds.length > 0) {
            const posts = await prisma.contentPost.findMany({
              where: { id: { in: upsertedIds } },
            });
            await Promise.all(
              posts.map((p) =>
                prisma.contentPost.update({
                  where: { id: p.id },
                  data: {
                    authorFollowers: followers,
                    engagementRate: (p.likes + p.comments + p.shares) / followers,
                  },
                })
              )
            );
          }
        } catch {
          // segue sem follower count — não bloqueia a conclusão do job
        }

        await prisma.scrapeJob.update({
          where: { id: job.id },
          data: { status: "SUCCESS", postsCollected: upsertedIds.length, finishedAt: new Date() },
        });

        await prisma.referenceProfile.update({
          where: { id: job.referenceProfile.id },
          data: { lastScrapedAt: new Date() },
        });

        await prisma.usageLog.create({
          data: {
            organizationId: job.referenceProfile.organizationId,
            type: "APIFY_SCRAPE",
            costCents: Math.round(upsertedIds.length * APIFY_INSTAGRAM_CENTS_PER_RESULT),
            metadata: { referenceProfileId: job.referenceProfile.id, apifyRunId: job.apifyRunId },
          },
        });

        results.push({ jobId: job.id, status: "SUCCESS", postsCollected: upsertedIds.length });
      } else if (FINISHED_FAILURE_STATUSES.has(run.status)) {
        await prisma.scrapeJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: `Run da Apify terminou com status ${run.status}.`,
            finishedAt: new Date(),
          },
        });
        results.push({ jobId: job.id, status: "FAILED" });
      }
      // Caso contrário (READY/RUNNING), o run ainda está em andamento — deixamos
      // para a próxima execução do cron.
    } catch (err) {
      results.push({
        jobId: job.id,
        status: "ERROR",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ checked: runningJobs.length, results });
}
