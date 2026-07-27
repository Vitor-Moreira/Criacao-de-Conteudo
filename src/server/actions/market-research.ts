"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Prisma } from "@/generated/prisma/client";
import { getEditableClientIds, canEditClient } from "@/lib/client-access";
import { marketResearchSchema } from "@/lib/validations/market-research";
import {
  anthropic,
  CLAUDE_MODEL,
  CLAUDE_INPUT_CENTS_PER_MTOK,
  CLAUDE_OUTPUT_CENTS_PER_MTOK,
} from "@/lib/claude";
import type { Message, TextBlock, WebSearchToolResultBlock } from "@anthropic-ai/sdk/resources/messages";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

const SYSTEM_PROMPT =
  "Você é um analista de tendências de mídias sociais de uma agência de conteúdo. " +
  "Use a busca na web para pesquisar tendências atuais sobre o tema informado. " +
  "Ao final, responda com um bloco JSON válido (pode vir depois de texto explicativo, mas deve ser o único objeto JSON da resposta), " +
  'no formato exato: {"summary": "<síntese executiva em 2-4 parágrafos>", "trendingFormats": ["<formato em alta 1>", "..."], ' +
  '"recurringHooks": ["<gancho/abertura recorrente 1>", "..."], "referenceAccounts": [{"label": "<@conta ou nome>", "note": "<por que é relevante>"}], ' +
  '"sources": [{"title": "<título>", "url": "<url>"}]}';

function formToInput(formData: FormData) {
  return {
    theme: formData.get("theme"),
    clientId: formData.get("clientId") || undefined,
  };
}

function parseResearchResponse(response: Message) {
  const textBlocks = response.content.filter((b): b is TextBlock => b.type === "text");
  const raw = textBlocks.map((b) => b.text).join("\n");
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  let parsed: {
    summary?: unknown;
    trendingFormats?: unknown;
    recurringHooks?: unknown;
    referenceAccounts?: unknown;
    sources?: unknown;
  } = {};
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = {};
    }
  }

  const searchSources: { title: string; url: string }[] = [];
  for (const block of response.content) {
    if (block.type === "web_search_tool_result") {
      const resultBlock = block as WebSearchToolResultBlock;
      if (Array.isArray(resultBlock.content)) {
        for (const r of resultBlock.content) {
          if (r.type === "web_search_result") {
            searchSources.push({ title: r.title, url: r.url });
          }
        }
      }
    }
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : raw || "Não foi possível gerar a síntese.",
    trendingFormats: Array.isArray(parsed.trendingFormats) ? parsed.trendingFormats : [],
    recurringHooks: Array.isArray(parsed.recurringHooks) ? parsed.recurringHooks : [],
    referenceAccounts: Array.isArray(parsed.referenceAccounts) ? parsed.referenceAccounts : [],
    sources:
      Array.isArray(parsed.sources) && parsed.sources.length > 0 ? parsed.sources : searchSources,
  };
}

export async function createMarketResearchAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = marketResearchSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(parsed.data.clientId ?? null, session.user.role, editableClientIds)) {
    return { error: "Sem permissão para criar uma pesquisa para este cliente." };
  }

  const client = parsed.data.clientId
    ? await prisma.client.findFirst({
        where: { id: parsed.data.clientId, organizationId: session.user.organizationId },
      })
    : null;

  // Cruza com o banco de conteúdos já coletado via Apify para o mesmo tema, servindo
  // de base interna de referência além da busca na web feita pelo Claude.
  const internalPosts = await prisma.contentPost.findMany({
    where: {
      organizationId: session.user.organizationId,
      caption: { contains: parsed.data.theme, mode: "insensitive" },
      ...(client ? { referenceProfile: { clientId: client.id } } : {}),
    },
    orderBy: { engagementRate: "desc" },
    take: 10,
    select: { authorHandle: true, caption: true, likes: true, comments: true, engagementRate: true },
  });

  const internalPostsBlock =
    internalPosts.length > 0
      ? internalPosts
          .map(
            (p, i) =>
              `${i + 1}. @${p.authorHandle} — ${(p.engagementRate * 100).toFixed(1)}% eng. — "${p.caption ?? "sem legenda"}"`
          )
          .join("\n")
      : "Nenhum post interno coletado sobre esse tema ainda.";

  const prompt = `
## Tema da pesquisa
${parsed.data.theme}

${client ? `## Cliente\n${client.name} (${client.segment ?? "segmento não informado"})\n` : ""}
## Posts internos já coletados sobre o tema (base de conteúdo capturada via Apify)
${internalPostsBlock}

## Tarefa
Pesquise na web tendências atuais sobre este tema para redes sociais (Instagram/TikTok/Reels), incluindo formatos em alta, ganchos/aberturas recorrentes e contas de referência. Combine com os posts internos acima quando relevante.
`.trim();

  let summary: string;
  let trendingFormats: unknown[] = [];
  let recurringHooks: unknown[] = [];
  let referenceAccounts: unknown[] = [];
  let sources: unknown[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3072,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: prompt }],
    });
    inputTokens = response.usage.input_tokens ?? 0;
    outputTokens = response.usage.output_tokens ?? 0;
    const result = parseResearchResponse(response);
    summary = result.summary;
    trendingFormats = result.trendingFormats;
    recurringHooks = result.recurringHooks;
    referenceAccounts = result.referenceAccounts;
    sources = result.sources;
  } catch (err) {
    summary = `Erro ao gerar pesquisa via Claude: ${err instanceof Error ? err.message : String(err)}`;
  }

  const research = await prisma.marketResearch.create({
    data: {
      organizationId: session.user.organizationId,
      clientId: client?.id,
      theme: parsed.data.theme,
      summary,
      trendingFormats: trendingFormats as Prisma.InputJsonValue,
      recurringHooks: recurringHooks as Prisma.InputJsonValue,
      referenceAccounts: referenceAccounts as Prisma.InputJsonValue,
      sources: sources as Prisma.InputJsonValue,
    },
  });

  if (inputTokens > 0 || outputTokens > 0) {
    const costCents =
      (inputTokens / 1_000_000) * CLAUDE_INPUT_CENTS_PER_MTOK +
      (outputTokens / 1_000_000) * CLAUDE_OUTPUT_CENTS_PER_MTOK;
    await prisma.usageLog.create({
      data: {
        organizationId: session.user.organizationId,
        clientId: client?.id,
        type: "WEB_SEARCH",
        costCents: Math.round(costCents),
        tokensUsed: inputTokens + outputTokens,
        metadata: { marketResearchId: research.id, theme: parsed.data.theme },
      },
    });
  }

  revalidatePath("/pesquisa-mercado");
  redirect(`/pesquisa-mercado/${research.id}`);
}

export async function deleteMarketResearchAction(researchId: string) {
  const session = await requireSession();

  const existing = await prisma.marketResearch.findFirst({
    where: { id: researchId, organizationId: session.user.organizationId },
  });
  if (!existing) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.clientId, session.user.role, editableClientIds)) return;

  await prisma.marketResearch.delete({ where: { id: researchId } });
  revalidatePath("/pesquisa-mercado");
  redirect("/pesquisa-mercado");
}
