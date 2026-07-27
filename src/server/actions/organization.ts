"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { organizationSchema } from "@/lib/validations/organization";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

export async function updateOrganizationAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  if (session.user.role !== "OWNER") {
    return { error: "Apenas o proprietário pode alterar os dados da organização." };
  }

  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    monthlyBudgetCents: formData.get("monthlyBudgetCents") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      name: parsed.data.name,
      monthlyBudgetCents: parsed.data.monthlyBudgetCents ?? null,
    },
  });

  revalidatePath("/configuracoes");
  return {};
}
