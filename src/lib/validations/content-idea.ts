import { z } from "zod";

export const contentIdeaSchema = z.object({
  title: z.string().min(2, "Informe um título."),
  description: z.string().optional(),
  theme: z.string().optional(),
  clientId: z
    .string()
    .optional()
    .transform((value) => (value && value !== "none" ? value : undefined)),
});

export type ContentIdeaInput = z.infer<typeof contentIdeaSchema>;
