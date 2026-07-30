"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Prisma } from "@/generated/prisma/client";
import { getEditableClientIds, canEditClient } from "@/lib/client-access";
import { creatorDiscoverySchema } from "@/lib/validations/creator-discovery";
import {
  anthropic,
  CLAUDE_MODEL,
  CLAUDE_INPUT_CENTS_PER_MTOK,
  CLAUDE_OUTPUT_CENTS_PER_MTOK,
} from "@/lib/claude";
import type { Message, TextBlock } from "@anthropic-ai/sdk/resources/messages";
import type { SocialNetwork } from "@/generated/prisma/client";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

export type CreatorResult = {
  handle: string;
  network: string;
  url: string;
  followersEstimate?: string;
  note?: string;
};

const SYSTEM_PROMPT =
  "Você é um pesquisador especialista em descobrir criadores de conteúdo (contas/perfis públicos) de mídias sociais. " +
  "Use a busca na web extensivamente para encontrar contas reais, ativas e com alto engajamento sobre o tema informado, " +
  "cobrindo Instagram, TikTok, YouTube e LinkedIn (quando fizer sentido para o tema). " +
  "Priorize criadores que estejam realmente publicando sobre o tema com frequência e engajamento relevante, não resultados genéricos. " +
  "Nunca invente contas: só inclua um perfil se encontrar evidência real dele (via busca) mencionando sua URL pública. " +
  "Ao final, responda com um bloco JSON válido (pode vir depois de texto explicativo, mas deve ser o único objeto JSON da resposta), " +
  'no formato exato: {"creators": [{"handle": "<@usuario>", "network": "INSTAGRAM|TIKTOK|YOUTUBE|LINKEDIN", "url": "<url pública do perfil>", "followersEstimate": "<estimativa de seguidores, se souber>", "note": "<por que esse perfil é relevante para o tema, com dados de engajamento quando disponíveis>"}]}. ' +
  "Traga entre 8 e 15 criadores, ordenados do mais para o menos relevante.";

function formToInput(formData: FormData) {
  return {
    theme: formData.get("theme"),
    clientId: formData.get("clientId") || undefined,
  };
}

function parseDiscoveryResponse(response: Message): CreatorResult[] {
  const textBlocks = response.content.filter((b): b is TextBlock => b.type === "text");
  const raw = textBlocks.map((b) => b.text).join("\n");
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { creators?: unknown };
    if (!Array.isArray(parsed.creators)) return [];
    return parsed.creators.filter(
      (c): c is CreatorResult =>
        !!c &&
        typeof c === "object" &&
        typeof (c as CreatorResult).handle === "string" &&
        typeof (c as CreatorResult).network === "string" &&
        typeof (c as CreatorResult).url === "string"
    );
  } catch {
    return [];
  }
}

export async function createCreatorDiscoveryAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = creatorDiscoverySchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(parsed.data.clientId ?? null, session.user.role, editableClientIds)) {
    return { error: "Sem permissão para buscar criadores para este cliente." };
  }

  const client = parsed.data.clientId
    ? await prisma.client.findFirst({
        where: { id: parsed.data.clientId, organizationId: session.user.organizationId },
      })
    : null;

  const prompt = `
## Tema
${parsed.data.theme}

${client ? `## Cliente\n${client.name} (${client.segment ?? "segmento não informado"})\n` : ""}
## Tarefa
Pesquise na web e liste os criadores de conteúdo (contas públicas) mais relevantes e com maior engajamento sobre este tema, com o link de cada perfil.
`.trim();

  let creators: CreatorResult[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let errorMessage: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages: [{ role: "user", content: prompt }],
    });
    inputTokens = response.usage.input_tokens ?? 0;
    outputTokens = response.usage.output_tokens ?? 0;
    creators = parseDiscoveryResponse(response);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const discovery = await prisma.creatorDiscovery.create({
    data: {
      organizationId: session.user.organizationId,
      clientId: client?.id,
      theme: parsed.data.theme,
      results: (errorMessage ? { error: errorMessage } : { creators }) as Prisma.InputJsonValue,
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
        metadata: { creatorDiscoveryId: discovery.id, theme: parsed.data.theme },
      },
    });
  }

  revalidatePath("/descobrir-criadores");
  redirect(`/descobrir-criadores/${discovery.id}`);
}

export async function deleteCreatorDiscoveryAction(discoveryId: string) {
  const session = await requireSession();

  const existing = await prisma.creatorDiscovery.findFirst({
    where: { id: discoveryId, organizationId: session.user.organizationId },
  });
  if (!existing) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.clientId, session.user.role, editableClientIds)) return;

  await prisma.creatorDiscovery.delete({ where: { id: discoveryId } });
  revalidatePath("/descobrir-criadores");
  redirect("/descobrir-criadores");
}

const VALID_NETWORKS: SocialNetwork[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "LINKEDIN"];

/// Associa criadores selecionados na descoberta a um cliente, criando (ou
/// reaproveitando, se já existir) um ReferenceProfile para cada um — o mesmo
/// modelo usado pela tela de Perfis de Referência, para que passem a aparecer
/// no monitoramento do cliente.
export async function addDiscoveredCreatorsAction(discoveryId: string, formData: FormData) {
  const session = await requireSession();

  const discovery = await prisma.creatorDiscovery.findFirst({
    where: { id: discoveryId, organizationId: session.user.organizationId },
  });
  if (!discovery) return;

  const clientIdRaw = formData.get("clientId");
  const clientId = typeof clientIdRaw === "string" && clientIdRaw !== "none" ? clientIdRaw : null;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(clientId, session.user.role, editableClientIds)) return;

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: session.user.organizationId },
    });
    if (!client) return;
  }

  const selectedRaw = formData.getAll("creator").map(String);
  const creators: CreatorResult[] = [];
  for (const raw of selectedRaw) {
    try {
      const parsed = JSON.parse(raw) as CreatorResult;
      if (parsed && typeof parsed.handle === "string" && typeof parsed.url === "string") {
        creators.push(parsed);
      }
    } catch {
      // ignora entradas malformadas
    }
  }
  if (creators.length === 0) return;

  for (const creator of creators) {
    const network = VALID_NETWORKS.includes(creator.network as SocialNetwork)
      ? (creator.network as SocialNetwork)
      : "INSTAGRAM";
    const handle = creator.handle.replace(/^@/, "").trim();
    if (!handle) continue;

    const existing = await prisma.referenceProfile.findUnique({
      where: {
        organizationId_network_handle: {
          organizationId: session.user.organizationId,
          network,
          handle,
        },
      },
    });

    if (existing) {
      if (clientId && !existing.clientId) {
        await prisma.referenceProfile.update({
          where: { id: existing.id },
          data: { clientId },
        });
      }
      continue;
    }

    await prisma.referenceProfile.create({
      data: {
        organizationId: session.user.organizationId,
        clientId,
        network,
        handle,
        url: creator.url,
        category: "Descoberto via busca de criadores",
        scrapeFrequency: "MANUAL",
      },
    });
  }

  revalidatePath("/perfis");
  revalidatePath(`/descobrir-criadores/${discoveryId}`);
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}
