"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { teamMemberSchema, clientAccessSchema } from "@/lib/validations/team-member";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

export async function createTeamMemberAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  if (session.user.role !== "OWNER") {
    return { error: "Apenas o proprietário pode adicionar membros da equipe." };
  }

  const parsed = teamMemberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) {
    return { error: "Já existe uma conta com este e-mail." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: passwordHash,
      role: parsed.data.role,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/configuracoes");
  return {};
}

export async function updateMemberRoleAction(memberId: string, formData: FormData) {
  const session = await requireSession();

  if (session.user.role !== "OWNER") return;
  if (memberId === session.user.id) return;

  const member = await prisma.user.findFirst({
    where: { id: memberId, organizationId: session.user.organizationId },
  });
  if (!member) return;

  const role = formData.get("role");
  if (role !== "OWNER" && role !== "MEMBER" && role !== "CLIENT") return;

  await prisma.user.update({ where: { id: memberId }, data: { role } });
  revalidatePath("/configuracoes");
}

export async function deleteMemberAction(memberId: string) {
  const session = await requireSession();

  if (session.user.role !== "OWNER") return;
  if (memberId === session.user.id) return;

  const member = await prisma.user.findFirst({
    where: { id: memberId, organizationId: session.user.organizationId },
  });
  if (!member) return;

  await prisma.user.delete({ where: { id: memberId } });
  revalidatePath("/configuracoes");
}

export async function createClientAccessAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  if (session.user.role !== "OWNER") {
    return { error: "Apenas o proprietário pode gerenciar permissões." };
  }

  const parsed = clientAccessSchema.safeParse({
    userId: formData.get("userId"),
    clientId: formData.get("clientId"),
    canEdit: formData.get("canEdit"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const [user, client] = await Promise.all([
    prisma.user.findFirst({
      where: { id: parsed.data.userId, organizationId: session.user.organizationId },
    }),
    prisma.client.findFirst({
      where: { id: parsed.data.clientId, organizationId: session.user.organizationId },
    }),
  ]);
  if (!user || !client) {
    return { error: "Usuário ou cliente inválido." };
  }

  await prisma.clientAccess.upsert({
    where: { userId_clientId: { userId: parsed.data.userId, clientId: parsed.data.clientId } },
    update: { canEdit: parsed.data.canEdit },
    create: {
      userId: parsed.data.userId,
      clientId: parsed.data.clientId,
      canEdit: parsed.data.canEdit,
    },
  });

  revalidatePath("/configuracoes");
  return {};
}

export async function deleteClientAccessAction(accessId: string) {
  const session = await requireSession();

  if (session.user.role !== "OWNER") return;

  const access = await prisma.clientAccess.findFirst({
    where: { id: accessId, user: { organizationId: session.user.organizationId } },
  });
  if (!access) return;

  await prisma.clientAccess.delete({ where: { id: accessId } });
  revalidatePath("/configuracoes");
}
