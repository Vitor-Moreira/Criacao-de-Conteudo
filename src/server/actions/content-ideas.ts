"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getEditableClientIds, canEditClient } from "@/lib/client-access";
import { contentIdeaSchema } from "@/lib/validations/content-idea";
import {
  anthropic,
  CLAUDE_MODEL,
  CLAUDE_INPUT_CENTS_PER_MTOK,
  CLAUDE_OUTPUT_CENTS_PER_MTOK,
} from "@/lib/claude";
import type { GeneratedAssetType, CalendarStatus } from "@/generated/prisma/client";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

const GENERATED_ASSET_TYPES: GeneratedAssetType[] = [
  "SCRIPT",
  "IMAGE_CONCEPT",
  "COPY",
  "HOOK_VARIATIONS",
];

const typeInstructions: Record<GeneratedAssetType, string> = {
  SCRIPT:
    "Escreva um roteiro completo para um vídeo curto (Reels/TikTok/Shorts), com estrutura de gancho (os 3 primeiros segundos), desenvolvimento e call-to-action. Separe claramente cada cena/fala em seções.",
  IMAGE_CONCEPT:
    "Descreva um conceito visual detalhado para uma imagem ou carrossel, servindo como briefing para o time de design ou para geração de imagem por IA (composição, cores, texto em tela, estilo).",
  COPY: "Escreva a legenda (copy) pronta para publicar, incluindo hashtags relevantes se fizer sentido.",
  HOOK_VARIATIONS:
    "Gere entre 6 e 8 variações de gancho/abertura (primeira frase) para este conteúdo, cada uma em uma linha numerada.",
};

const SYSTEM_PROMPT =
  "Você é um estrategista de conteúdo sênior de uma agência de mídias digitais. " +
  "Gere ativos de conteúdo de alta qualidade, criativos e alinhados à marca do cliente, com base no briefing fornecido. " +
  "Formate o campo \"content\" usando Markdown (títulos com ##, negrito com **texto**, listas com - ou números, e linhas em branco entre seções) para que fique bem diagramado e fácil de ler, em vez de um bloco de texto corrido. " +
  "Responda ESTRITAMENTE em JSON válido (o valor de \"content\" é uma string Markdown dentro do JSON, com quebras de linha escapadas como \\n), sem markdown fora da string e sem texto fora do objeto JSON.";

function formToIdeaInput(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    theme: formData.get("theme") || undefined,
    clientId: formData.get("clientId") || undefined,
  };
}

export async function createContentIdeaAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = contentIdeaSchema.safeParse(formToIdeaInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(parsed.data.clientId ?? null, session.user.role, editableClientIds)) {
    return { error: "Sem permissão para criar uma ideia para este cliente." };
  }

  const idea = await prisma.contentIdea.create({
    data: {
      ...parsed.data,
      organizationId: session.user.organizationId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/estudio");
  redirect(`/estudio/${idea.id}`);
}

export async function deleteContentIdeaAction(ideaId: string) {
  const session = await requireSession();

  const existing = await prisma.contentIdea.findFirst({
    where: { id: ideaId, organizationId: session.user.organizationId },
  });
  if (!existing) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.clientId, session.user.role, editableClientIds)) return;

  await prisma.contentIdea.delete({ where: { id: ideaId } });
  revalidatePath("/estudio");
  redirect("/estudio");
}

export async function updateContentIdeaAction(ideaId: string, formData: FormData) {
  const session = await requireSession();

  const idea = await prisma.contentIdea.findFirst({
    where: { id: ideaId, organizationId: session.user.organizationId },
  });
  if (!idea) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(idea.clientId, session.user.role, editableClientIds)) return;

  const title = formData.get("title");
  if (typeof title !== "string" || title.trim().length < 2) return;

  const description = formData.get("description");
  const theme = formData.get("theme");

  await prisma.contentIdea.update({
    where: { id: ideaId },
    data: {
      title: title.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      theme: typeof theme === "string" && theme.trim() ? theme.trim() : null,
    },
  });

  revalidatePath(`/estudio/${ideaId}`);
  revalidatePath("/estudio");
}

export async function deleteGeneratedAssetAction(ideaId: string, assetId: string) {
  const session = await requireSession();

  const idea = await prisma.contentIdea.findFirst({
    where: { id: ideaId, organizationId: session.user.organizationId },
  });
  if (!idea) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(idea.clientId, session.user.role, editableClientIds)) return;

  await prisma.generatedAsset.delete({ where: { id: assetId, contentIdeaId: ideaId } });
  revalidatePath(`/estudio/${ideaId}`);
}

export async function addSourcePostsAction(ideaId: string, formData: FormData) {
  const session = await requireSession();

  const idea = await prisma.contentIdea.findFirst({
    where: { id: ideaId, organizationId: session.user.organizationId },
  });
  if (!idea) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(idea.clientId, session.user.role, editableClientIds)) return;

  const postIds = formData.getAll("postIds").map(String).filter(Boolean);
  if (postIds.length > 0) {
    await prisma.contentIdeaSourcePost.createMany({
      data: postIds.map((postId) => ({ ideaId, postId })),
      skipDuplicates: true,
    });
  }

  revalidatePath(`/estudio/${ideaId}`);
}

export async function removeSourcePostAction(ideaId: string, postId: string) {
  const session = await requireSession();

  const idea = await prisma.contentIdea.findFirst({
    where: { id: ideaId, organizationId: session.user.organizationId },
  });
  if (!idea) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(idea.clientId, session.user.role, editableClientIds)) return;

  await prisma.contentIdeaSourcePost.delete({
    where: { ideaId_postId: { ideaId, postId } },
  });
  revalidatePath(`/estudio/${ideaId}`);
}

const CALENDAR_STATUSES: CalendarStatus[] = ["IDEA", "SCRIPT_READY", "IN_PRODUCTION", "PUBLISHED"];

export async function updateContentIdeaScheduleAction(ideaId: string, formData: FormData) {
  const session = await requireSession();

  const idea = await prisma.contentIdea.findFirst({
    where: { id: ideaId, organizationId: session.user.organizationId },
  });
  if (!idea) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(idea.clientId, session.user.role, editableClientIds)) return;

  const status = formData.get("status");
  const scheduledDateRaw = formData.get("scheduledDate");

  const data: { status?: CalendarStatus; scheduledDate?: Date | null } = {};
  if (typeof status === "string" && CALENDAR_STATUSES.includes(status as CalendarStatus)) {
    data.status = status as CalendarStatus;
  }
  if (typeof scheduledDateRaw === "string") {
    data.scheduledDate = scheduledDateRaw ? new Date(`${scheduledDateRaw}T12:00:00`) : null;
  }

  await prisma.contentIdea.update({ where: { id: ideaId }, data });

  revalidatePath(`/estudio/${ideaId}`);
  revalidatePath("/calendario");
}

function buildPrompt(
  idea: {
    title: string;
    description: string | null;
    theme: string | null;
    client: {
      name: string;
      segment: string | null;
      businessSummary: string | null;
      targetAudience: string | null;
      toneOfVoice: string | null;
      contentPillars: string[];
      restrictions: string[];
    } | null;
    sourcePosts: {
      post: { authorHandle: string; likes: number; comments: number; caption: string | null };
    }[];
  },
  type: GeneratedAssetType
) {
  const clientBlock = idea.client
    ? [
        `Cliente: ${idea.client.name}`,
        `Segmento: ${idea.client.segment ?? "não informado"}`,
        `Resumo do negócio: ${idea.client.businessSummary ?? "não informado"}`,
        `Público-alvo: ${idea.client.targetAudience ?? "não informado"}`,
        `Tom de voz: ${idea.client.toneOfVoice ?? "não informado"}`,
        `Pilares de conteúdo: ${idea.client.contentPillars.join(", ") || "não informado"}`,
        `Restrições: ${idea.client.restrictions.join(", ") || "nenhuma"}`,
      ].join("\n")
    : "Nenhum cliente específico associado — use um tom neutro e profissional.";

  const sourcePostsBlock =
    idea.sourcePosts.length > 0
      ? idea.sourcePosts
          .map(
            (sp, i) =>
              `${i + 1}. (@${sp.post.authorHandle}, ${sp.post.likes} curtidas, ${sp.post.comments} comentários) "${sp.post.caption ?? "sem legenda"}"`
          )
          .join("\n")
      : "Nenhum post de referência selecionado.";

  return `
## Briefing da ideia
Título: ${idea.title}
Tema: ${idea.theme ?? "não informado"}
Descrição: ${idea.description ?? "não informado"}

## Cliente
${clientBlock}

## Posts de referência (inspiração de formato/tom, não copiar conteúdo)
${sourcePostsBlock}

## Tarefa
${typeInstructions[type]}

Responda ESTRITAMENTE em JSON, sem texto fora do objeto JSON, no formato exato:
{"content": "<o ativo gerado, formatado em Markdown (##, **negrito**, listas), com quebras de linha escapadas como \\n>", "brandFitScore": <número inteiro de 0 a 100 avaliando o alinhamento do conteúdo gerado ao tom de voz e pilares do cliente>, "brandFitJustification": "<justificativa breve da nota, 1-2 frases>"}
`.trim();
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as {
      content?: unknown;
      brandFitScore?: unknown;
      brandFitJustification?: unknown;
    };
  } catch {
    return null;
  }
}

function parseGenerationResponse(raw: string) {
  const cleaned = raw.trim().replace(/^```json\s*|```$/g, "");

  // Primeiro tenta o texto inteiro; se a resposta vier com algo antes/depois do
  // objeto JSON (ou o modelo cortar antes de fechar todas as chaves por causa
  // do limite de tokens), tenta extrair só o maior bloco {...} encontrado.
  let parsed = tryParseJson(cleaned);
  if (!parsed) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = tryParseJson(jsonMatch[0]);
  }

  if (!parsed) {
    return { content: raw, brandFitScore: null, brandFitJustification: null };
  }

  return {
    content: typeof parsed.content === "string" ? parsed.content : raw,
    brandFitScore: typeof parsed.brandFitScore === "number" ? parsed.brandFitScore : null,
    brandFitJustification:
      typeof parsed.brandFitJustification === "string" ? parsed.brandFitJustification : null,
  };
}

export async function generateAssetAction(ideaId: string, formData: FormData) {
  const session = await requireSession();

  const type = formData.get("type");
  if (typeof type !== "string" || !GENERATED_ASSET_TYPES.includes(type as GeneratedAssetType)) {
    return;
  }
  const assetType = type as GeneratedAssetType;

  const idea = await prisma.contentIdea.findFirst({
    where: { id: ideaId, organizationId: session.user.organizationId },
    include: {
      client: true,
      sourcePosts: { include: { post: true } },
    },
  });
  if (!idea) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(idea.clientId, session.user.role, editableClientIds)) return;

  const prompt = buildPrompt(idea, assetType);

  let content: string;
  let brandFitScore: number | null = null;
  let brandFitJustification: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    inputTokens = response.usage.input_tokens ?? 0;
    outputTokens = response.usage.output_tokens;
    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
    const parsed = parseGenerationResponse(raw);
    content = parsed.content;
    brandFitScore = parsed.brandFitScore;
    brandFitJustification = parsed.brandFitJustification;
  } catch (err) {
    content = `Erro ao gerar conteúdo via Claude: ${err instanceof Error ? err.message : String(err)}`;
  }

  const existingCount = await prisma.generatedAsset.count({
    where: { contentIdeaId: idea.id, type: assetType },
  });

  await prisma.generatedAsset.create({
    data: {
      contentIdeaId: idea.id,
      clientId: idea.clientId,
      type: assetType,
      content,
      version: existingCount + 1,
      promptUsed: prompt,
      brandFitScore,
      brandFitJustification,
      createdById: session.user.id,
    },
  });

  if (inputTokens > 0 || outputTokens > 0) {
    const costCents =
      (inputTokens / 1_000_000) * CLAUDE_INPUT_CENTS_PER_MTOK +
      (outputTokens / 1_000_000) * CLAUDE_OUTPUT_CENTS_PER_MTOK;
    await prisma.usageLog.create({
      data: {
        organizationId: session.user.organizationId,
        clientId: idea.clientId,
        type: "CLAUDE_GENERATION",
        costCents: Math.round(costCents),
        tokensUsed: inputTokens + outputTokens,
        metadata: { contentIdeaId: idea.id, assetType },
      },
    });
  }

  revalidatePath(`/estudio/${ideaId}`);
}
