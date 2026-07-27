"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getEditableClientIds, canEditClient } from "@/lib/client-access";
import { referenceProfileSchema } from "@/lib/validations/reference-profile";
import { apifyClient, INSTAGRAM_SCRAPER_ACTOR_ID } from "@/lib/apify";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

function formToProfileInput(formData: FormData) {
  return {
    network: formData.get("network"),
    handle: formData.get("handle"),
    url: formData.get("url"),
    category: formData.get("category") || undefined,
    scrapeFrequency: formData.get("scrapeFrequency") || "MANUAL",
    clientId: formData.get("clientId") || undefined,
  };
}

export async function createReferenceProfileAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = referenceProfileSchema.safeParse(formToProfileInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(parsed.data.clientId ?? null, session.user.role, editableClientIds)) {
    return { error: "Sem permissão para criar um perfil para este cliente." };
  }

  const existing = await prisma.referenceProfile.findUnique({
    where: {
      organizationId_network_handle: {
        organizationId: session.user.organizationId,
        network: parsed.data.network,
        handle: parsed.data.handle,
      },
    },
  });
  if (existing) {
    return { error: "Já existe um perfil cadastrado com essa rede e handle." };
  }

  const profile = await prisma.referenceProfile.create({
    data: {
      ...parsed.data,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/perfis");
  redirect(`/perfis/${profile.id}`);
}

export async function updateReferenceProfileAction(
  profileId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = referenceProfileSchema.safeParse(formToProfileInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const existing = await prisma.referenceProfile.findFirst({
    where: { id: profileId, organizationId: session.user.organizationId },
  });
  if (!existing) {
    return { error: "Perfil não encontrado." };
  }

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (
    !canEditClient(existing.clientId, session.user.role, editableClientIds) ||
    !canEditClient(parsed.data.clientId ?? null, session.user.role, editableClientIds)
  ) {
    return { error: "Sem permissão para editar este perfil." };
  }

  await prisma.referenceProfile.update({
    where: { id: profileId },
    data: parsed.data,
  });

  revalidatePath("/perfis");
  revalidatePath(`/perfis/${profileId}`);
  return {};
}

export async function deleteReferenceProfileAction(profileId: string) {
  const session = await requireSession();

  const existing = await prisma.referenceProfile.findFirst({
    where: { id: profileId, organizationId: session.user.organizationId },
  });
  if (!existing) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.clientId, session.user.role, editableClientIds)) return;

  await prisma.referenceProfile.delete({ where: { id: profileId } });
  revalidatePath("/perfis");
  redirect("/perfis");
}

/// Dispara uma coleta assíncrona via Apify. O run é apenas iniciado aqui (start,
/// não call) — quem confirma a conclusão e ingere os resultados é o cron job em
/// /api/cron/poll-scrape-jobs, que faz o polling dos ScrapeJobs com status RUNNING.
export async function triggerScrapeAction(profileId: string) {
  const session = await requireSession();

  const profile = await prisma.referenceProfile.findFirst({
    where: { id: profileId, organizationId: session.user.organizationId },
  });
  if (!profile) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(profile.clientId, session.user.role, editableClientIds)) return;

  if (profile.network !== "INSTAGRAM") {
    // Scraping automático via Apify só está implementado para Instagram por enquanto.
    return;
  }

  const job = await prisma.scrapeJob.create({
    data: { referenceProfileId: profile.id, status: "PENDING" },
  });

  try {
    const run = await apifyClient.actor(INSTAGRAM_SCRAPER_ACTOR_ID).start({
      directUrls: [profile.url],
      resultsType: "posts",
      resultsLimit: 50,
      addParentData: false,
    });

    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", apifyRunId: run.id, startedAt: new Date() },
    });
  } catch (err) {
    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Erro ao iniciar a coleta na Apify.",
        finishedAt: new Date(),
      },
    });
  }

  revalidatePath(`/perfis/${profileId}`);
}
