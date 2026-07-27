import { z } from "zod";

export const referenceProfileSchema = z.object({
  network: z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE", "LINKEDIN"]),
  handle: z.string().min(1, "Informe o @ ou identificador do perfil."),
  url: z.string().url("Informe uma URL válida."),
  category: z.string().optional(),
  scrapeFrequency: z.enum(["MANUAL", "DAILY", "WEEKLY"]).default("MANUAL"),
  clientId: z
    .string()
    .optional()
    .transform((value) => (value && value !== "none" ? value : undefined)),
});

export type ReferenceProfileInput = z.infer<typeof referenceProfileSchema>;
