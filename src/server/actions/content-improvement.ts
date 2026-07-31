"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getEditableClientIds, canEditClient } from "@/lib/client-access";
import { contentImprovementSchema } from "@/lib/validations/content-improvement";
import {
  extractTextFromFile,
  FileTooLargeError,
  UnsupportedFileTypeError,
} from "@/lib/document-parsing";
import { generateDocxBuffer, generatePdfBuffer, generateXlsxBuffer } from "@/lib/document-generation";
import {
  anthropic,
  CLAUDE_MODEL,
  CLAUDE_INPUT_CENTS_PER_MTOK,
  CLAUDE_OUTPUT_CENTS_PER_MTOK,
} from "@/lib/claude";
import type { Message, TextBlock } from "@anthropic-ai/sdk/resources/messages";
import type { ContentImprovementSourceType } from "@/generated/prisma/client";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

type ClientProfileSuggestion = {
  businessSummary?: string;
  targetAudience?: string;
  toneOfVoice?: string;
  contentPillars?: string[];
};

type ImprovementResponse = {
  analysis: string;
  improvedText: string;
  improvedSheets?: { name: string; rows: string[][] }[];
  clientProfile?: ClientProfileSuggestion;
};

const SYSTEM_PROMPT =
  "Você é um estrategista de conteúdo sênior de uma agência de mídia, especialista em revisar e melhorar conteúdos já " +
  "planejados (roteiros, copies, planejamentos, planilhas de calendário editorial etc.) antes da publicação. " +
  "Analise o conteúdo enviado com senso crítico: identifique pontos fortes, pontos fracos e oportunidades de melhoria " +
  "concretas (clareza, gancho, estrutura, chamada para ação, adequação ao formato/rede e, principalmente, aderência ao " +
  "tom de voz, público-alvo, pilares de conteúdo e restrições do cliente quando informados). Depois, produza uma versão " +
  "melhorada do conteúdo, mantendo a essência e a intenção original, mas elevando a qualidade. " +
  "Ao final da resposta, inclua um único bloco JSON válido (pode vir depois de texto explicativo, mas deve ser o único " +
  "objeto JSON da resposta) com a análise e o conteúdo melhorado.";

function buildResponseSchemaInstruction(
  sourceType: ContentImprovementSourceType,
  needsClientProfile: boolean
) {
  const base =
    '{"analysis": "<análise em markdown: pontos fortes, pontos fracos, sugestões>", "improvedText": "<versão melhorada em markdown>"';
  const sheets =
    sourceType === "XLSX"
      ? ', "improvedSheets": [{"name": "<nome da aba>", "rows": [["<célula>", "..."], ["..."]]}]'
      : "";
  const profile = needsClientProfile
    ? ', "clientProfile": {"businessSummary": "<resumo do negócio inferido>", "targetAudience": "<público-alvo inferido>", "toneOfVoice": "<tom de voz inferido>", "contentPillars": ["<pilar 1>", "<pilar 2>"]}'
    : "";

  let instructions = base + sheets + profile + "}. ";
  if (sourceType === "XLSX") {
    instructions +=
      "Como o conteúdo original é uma planilha, preencha SEMPRE improvedSheets com a versão melhorada em formato " +
      "tabular (linhas e colunas, incluindo cabeçalho quando fizer sentido); improvedText deve ser um resumo textual " +
      "das principais mudanças feitas. ";
  }
  if (needsClientProfile) {
    instructions +=
      "Como o usuário pediu para criar um cliente novo a partir deste conteúdo, preencha clientProfile com base no " +
      "que puder inferir do texto (use string vazia ou array vazio nos campos que não for possível inferir).";
  }
  return instructions.trim();
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseImprovementResponse(response: Message): ImprovementResponse | null {
  const textBlocks = response.content.filter((b): b is TextBlock => b.type === "text");
  const raw = textBlocks
    .map((b) => b.text)
    .join("\n")
    .trim();

  let parsed = tryParseJson(raw);
  if (!parsed) {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = tryParseJson(jsonMatch[0]);
  }
  if (!parsed || typeof parsed !== "object") return null;

  const result = parsed as Partial<ImprovementResponse>;
  if (typeof result.analysis !== "string" || typeof result.improvedText !== "string") {
    return null;
  }

  return {
    analysis: result.analysis,
    improvedText: result.improvedText,
    improvedSheets: Array.isArray(result.improvedSheets) ? result.improvedSheets : undefined,
    clientProfile:
      result.clientProfile && typeof result.clientProfile === "object"
        ? (result.clientProfile as ClientProfileSuggestion)
        : undefined,
  };
}

function extensionFor(sourceType: ContentImprovementSourceType) {
  switch (sourceType) {
    case "PDF":
      return "pdf";
    case "DOCX":
      return "docx";
    case "XLSX":
      return "xlsx";
    default:
      return "txt";
  }
}

function contentTypeFor(sourceType: ContentImprovementSourceType) {
  switch (sourceType) {
    case "PDF":
      return "application/pdf";
    case "DOCX":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "XLSX":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "text/plain";
  }
}

export async function createContentImprovementAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const sourceModeRaw = formData.get("sourceMode");
  const clientModeRaw = formData.get("clientMode");

  const parsed = contentImprovementSchema.safeParse({
    title: formData.get("title") || "",
    sourceMode: sourceModeRaw === "file" ? "file" : "text",
    text: formData.get("text") || undefined,
    clientMode:
      clientModeRaw === "existing" || clientModeRaw === "new" ? clientModeRaw : "none",
    clientId: formData.get("clientId") || undefined,
    newClientName: formData.get("newClientName") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.clientMode === "new" && session.user.role === "CLIENT") {
    return { error: "Sem permissão para criar clientes." };
  }

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (
    parsed.data.clientMode === "existing" &&
    !canEditClient(parsed.data.clientId ?? null, session.user.role, editableClientIds)
  ) {
    return { error: "Sem permissão para associar conteúdo a este cliente." };
  }

  let sourceType: ContentImprovementSourceType = "TEXT";
  let originalText = "";
  let originalFileUrl: string | undefined;
  let truncated = false;

  if (parsed.data.sourceMode === "file") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Envie um arquivo PDF, DOCX ou XLSX." };
    }

    try {
      const extracted = await extractTextFromFile(file);
      sourceType = extracted.sourceType;
      originalText = extracted.text;
      truncated = extracted.truncated;
    } catch (err) {
      if (err instanceof UnsupportedFileTypeError || err instanceof FileTooLargeError) {
        return { error: err.message };
      }
      return { error: "Não foi possível ler o arquivo enviado." };
    }

    const uploaded = await put(`content-improvements/${crypto.randomUUID()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    originalFileUrl = uploaded.url;
  } else {
    originalText = (parsed.data.text ?? "").trim();
  }

  let existingClientId: string | undefined;
  let briefingBlock = "";

  if (parsed.data.clientMode === "existing" && parsed.data.clientId) {
    const existingClient = await prisma.client.findFirst({
      where: { id: parsed.data.clientId, organizationId: session.user.organizationId },
      include: { knowledgeItems: { where: { type: "BRIEFING" }, take: 5 } },
    });
    if (!existingClient) {
      return { error: "Cliente não encontrado." };
    }

    existingClientId = existingClient.id;
    briefingBlock = [
      `## Premissas de briefing do cliente "${existingClient.name}"`,
      existingClient.businessSummary ? `Resumo do negócio: ${existingClient.businessSummary}` : "",
      existingClient.targetAudience ? `Público-alvo: ${existingClient.targetAudience}` : "",
      existingClient.toneOfVoice ? `Tom de voz: ${existingClient.toneOfVoice}` : "",
      existingClient.contentPillars.length
        ? `Pilares de conteúdo: ${existingClient.contentPillars.join(", ")}`
        : "",
      existingClient.restrictions.length
        ? `Restrições: ${existingClient.restrictions.join(", ")}`
        : "",
      ...existingClient.knowledgeItems.map(
        (item) => `\n### ${item.title}\n${(item.content ?? "").slice(0, 3000)}`
      ),
    ]
      .filter(Boolean)
      .join("\n");
  }

  const needsClientProfile = parsed.data.clientMode === "new";

  const prompt = `
## Título
${parsed.data.title}

${briefingBlock ? `${briefingBlock}\n\n` : ""}## Conteúdo enviado (formato original: ${sourceType})
${originalText || "(vazio)"}
${truncated ? "\n(nota: o conteúdo foi truncado por ser muito extenso)" : ""}

## Tarefa
Analise este conteúdo e produza sugestões de melhoria concretas${
    briefingBlock ? ", respeitando as premissas de briefing acima" : ""
  }. Depois, gere uma versão melhorada do conteúdo completo.

## Formato de resposta
${buildResponseSchemaInstruction(sourceType, needsClientProfile)}
`.trim();

  let result: ImprovementResponse | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let errorMessage: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 6144,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    inputTokens = response.usage.input_tokens ?? 0;
    outputTokens = response.usage.output_tokens ?? 0;
    result = parseImprovementResponse(response);
    if (!result) errorMessage = "Não foi possível interpretar a resposta da IA.";
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  let clientId: string | undefined = existingClientId;

  if (needsClientProfile && parsed.data.newClientName) {
    const profile = result?.clientProfile;
    const newClient = await prisma.client.create({
      data: {
        organizationId: session.user.organizationId,
        name: parsed.data.newClientName,
        businessSummary: profile?.businessSummary || undefined,
        targetAudience: profile?.targetAudience || undefined,
        toneOfVoice: profile?.toneOfVoice || undefined,
        contentPillars: Array.isArray(profile?.contentPillars) ? profile.contentPillars : [],
      },
    });
    clientId = newClient.id;
  }

  let resultFileUrl: string | undefined;
  if (result && sourceType !== "TEXT") {
    try {
      let buffer: Buffer;
      if (sourceType === "PDF") {
        buffer = await generatePdfBuffer(result.improvedText, parsed.data.title);
      } else if (sourceType === "DOCX") {
        buffer = await generateDocxBuffer(result.improvedText, parsed.data.title);
      } else {
        buffer = await generateXlsxBuffer(result.improvedSheets ?? []);
      }
      const uploadedResult = await put(
        `content-improvements/${crypto.randomUUID()}-melhorado.${extensionFor(sourceType)}`,
        buffer,
        { access: "public", addRandomSuffix: true, contentType: contentTypeFor(sourceType) }
      );
      resultFileUrl = uploadedResult.url;
    } catch {
      // Se a geração do arquivo de saída falhar, ainda mostramos a análise/texto melhorado no sistema.
    }
  }

  const record = await prisma.contentImprovement.create({
    data: {
      organizationId: session.user.organizationId,
      clientId,
      title: parsed.data.title,
      sourceType,
      originalFileUrl,
      originalText,
      analysis: result?.analysis,
      improvedText: result?.improvedText,
      resultFileUrl,
      errorMessage: errorMessage ?? undefined,
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
        clientId,
        type: "CLAUDE_GENERATION",
        costCents: Math.round(costCents),
        tokensUsed: inputTokens + outputTokens,
        metadata: { contentImprovementId: record.id, title: parsed.data.title },
      },
    });
  }

  revalidatePath("/melhorar-conteudo");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  redirect(`/melhorar-conteudo/${record.id}`);
}

export async function deleteContentImprovementAction(id: string) {
  const session = await requireSession();

  const existing = await prisma.contentImprovement.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.clientId, session.user.role, editableClientIds)) return;

  await prisma.contentImprovement.delete({ where: { id } });
  revalidatePath("/melhorar-conteudo");
  if (existing.clientId) revalidatePath(`/clientes/${existing.clientId}`);
  redirect("/melhorar-conteudo");
}
