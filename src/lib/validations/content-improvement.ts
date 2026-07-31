import { z } from "zod";

export const contentImprovementSchema = z
  .object({
    title: z.string().min(2, "Informe um título."),
    sourceMode: z.enum(["text", "file"]),
    text: z.string().optional(),
    clientMode: z.enum(["none", "existing", "new"]).default("none"),
    clientId: z.string().optional(),
    newClientName: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceMode === "text" && (!data.text || data.text.trim().length < 20)) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: "Cole um texto com pelo menos 20 caracteres.",
      });
    }
    if (data.clientMode === "existing" && !data.clientId) {
      ctx.addIssue({
        code: "custom",
        path: ["clientId"],
        message: "Selecione um cliente.",
      });
    }
    if (data.clientMode === "new" && (!data.newClientName || data.newClientName.trim().length < 2)) {
      ctx.addIssue({
        code: "custom",
        path: ["newClientName"],
        message: "Informe o nome do novo cliente.",
      });
    }
  });

export type ContentImprovementInput = z.infer<typeof contentImprovementSchema>;
