import { z } from "zod";

export const collectionSchema = z.object({
  name: z.string().min(2, "Informe um nome para a coleção."),
  clientId: z
    .string()
    .optional()
    .transform((value) => (value && value !== "none" ? value : undefined)),
});

export type CollectionInput = z.infer<typeof collectionSchema>;
