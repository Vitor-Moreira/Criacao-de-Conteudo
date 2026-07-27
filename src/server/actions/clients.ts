"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getEditableClientIds, canEditClient } from "@/lib/client-access";
import { clientSchema, knowledgeItemSchema } from "@/lib/validations/client";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

function formToClientInput(formData: FormData) {
  return {
    name: formData.get("name"),
    segment: formData.get("segment") || undefined,
    businessSummary: formData.get("businessSummary") || undefined,
    targetAudience: formData.get("targetAudience") || undefined,
    toneOfVoice: formData.get("toneOfVoice") || undefined,
    contentPillars: formData.get("contentPillars") || "",
    restrictions: formData.get("restrictions") || "",
    status: formData.get("status") || "ACTIVE",
  };
}

export async function createClientAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  if (session.user.role === "CLIENT") {
    return { error: "Sem permissão para criar clientes." };
  }

  const parsed = clientSchema.safeParse(formToClientInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const client = await prisma.client.create({
    data: {
      ...parsed.data,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${client.id}`);
}

export async function updateClientAction(
  clientId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = clientSchema.safeParse(formToClientInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const existing = await prisma.client.findFirst({
    where: { id: clientId, organizationId: session.user.organizationId },
  });
  if (!existing) {
    return { error: "Cliente não encontrado." };
  }

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.id, session.user.role, editableClientIds)) {
    return { error: "Sem permissão para editar este cliente." };
  }

  await prisma.client.update({
    where: { id: clientId },
    data: parsed.data,
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  return {};
}

export async function addKnowledgeItemAction(
  clientId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const existing = await prisma.client.findFirst({
    where: { id: clientId, organizationId: session.user.organizationId },
  });
  if (!existing) {
    return { error: "Cliente não encontrado." };
  }

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.id, session.user.role, editableClientIds)) {
    return { error: "Sem permissão para editar este cliente." };
  }

  const parsed = knowledgeItemSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.clientKnowledgeItem.create({
    data: {
      clientId,
      title: parsed.data.title,
      type: parsed.data.type,
      content: parsed.data.content,
    },
  });

  revalidatePath(`/clientes/${clientId}`);
  return {};
}

export async function deleteKnowledgeItemAction(clientId: string, itemId: string) {
  const session = await requireSession();

  const existing = await prisma.client.findFirst({
    where: { id: clientId, organizationId: session.user.organizationId },
  });
  if (!existing) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.id, session.user.role, editableClientIds)) return;

  await prisma.clientKnowledgeItem.delete({ where: { id: itemId } });
  revalidatePath(`/clientes/${clientId}`);
}
