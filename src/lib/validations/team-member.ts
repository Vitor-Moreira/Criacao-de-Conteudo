import { z } from "zod";

export const teamMemberSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  role: z.enum(["OWNER", "MEMBER", "CLIENT"]),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

export const clientAccessSchema = z.object({
  userId: z.string().min(1, "Selecione um usuário."),
  clientId: z.string().min(1, "Selecione um cliente."),
  canEdit: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export type ClientAccessInput = z.infer<typeof clientAccessSchema>;
