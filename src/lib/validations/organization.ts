import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().min(2, "Informe o nome da organização."),
  monthlyBudgetCents: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const num = Number(value.replace(",", "."));
      return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) : undefined;
    }),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
