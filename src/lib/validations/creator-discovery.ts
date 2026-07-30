import { z } from "zod";

export const creatorDiscoverySchema = z.object({
  theme: z.string().min(2, "Informe um tema para a busca."),
  clientId: z
    .string()
    .optional()
    .transform((value) => (value && value !== "none" ? value : undefined)),
});

export type CreatorDiscoveryInput = z.infer<typeof creatorDiscoverySchema>;
