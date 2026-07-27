import { z } from "zod";

export const marketResearchSchema = z.object({
  theme: z.string().min(2, "Informe um tema para a pesquisa."),
  clientId: z
    .string()
    .optional()
    .transform((value) => (value && value !== "none" ? value : undefined)),
});

export type MarketResearchInput = z.infer<typeof marketResearchSchema>;
