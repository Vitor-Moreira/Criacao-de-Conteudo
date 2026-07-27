import { z } from "zod";

function csvToArray(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const clientSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente."),
  segment: z.string().optional(),
  businessSummary: z.string().optional(),
  targetAudience: z.string().optional(),
  toneOfVoice: z.string().optional(),
  contentPillars: z.preprocess(csvToArray, z.array(z.string())),
  restrictions: z.preprocess(csvToArray, z.array(z.string())),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const knowledgeItemSchema = z.object({
  title: z.string().min(2, "Informe um título."),
  type: z.enum(["DOCUMENT", "BRIEFING", "PERSONA", "GLOSSARY", "OTHER"]),
  content: z.string().min(1, "Informe o conteúdo."),
});

export type KnowledgeItemInput = z.infer<typeof knowledgeItemSchema>;
