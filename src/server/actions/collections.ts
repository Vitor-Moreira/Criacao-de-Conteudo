"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  getEditableClientIds,
  getAccessibleClientIds,
  canEditClient,
  postClientScopeFilter,
  clientScopeFilter,
} from "@/lib/client-access";
import { collectionSchema } from "@/lib/validations/collection";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

function formToCollectionInput(formData: FormData) {
  return {
    name: formData.get("name"),
    clientId: formData.get("clientId") || undefined,
  };
}

export async function createCollectionAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = collectionSchema.safeParse(formToCollectionInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(parsed.data.clientId ?? null, session.user.role, editableClientIds)) {
    return { error: "Sem permissão para criar uma coleção para este cliente." };
  }

  const collection = await prisma.collection.create({
    data: {
      ...parsed.data,
      organizationId: session.user.organizationId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/colecoes");
  redirect(`/colecoes/${collection.id}`);
}

export async function deleteCollectionAction(collectionId: string) {
  const session = await requireSession();

  const existing = await prisma.collection.findFirst({
    where: { id: collectionId, organizationId: session.user.organizationId },
  });
  if (!existing) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.clientId, session.user.role, editableClientIds)) return;

  await prisma.collection.delete({ where: { id: collectionId } });
  revalidatePath("/colecoes");
  redirect("/colecoes");
}

export async function updateCollectionAction(collectionId: string, formData: FormData) {
  const session = await requireSession();

  const existing = await prisma.collection.findFirst({
    where: { id: collectionId, organizationId: session.user.organizationId },
  });
  if (!existing) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(existing.clientId, session.user.role, editableClientIds)) return;

  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length < 2) return;

  await prisma.collection.update({ where: { id: collectionId }, data: { name: name.trim() } });
  revalidatePath(`/colecoes/${collectionId}`);
  revalidatePath("/colecoes");
}

export async function addCollectionPostsAction(collectionId: string, formData: FormData) {
  const session = await requireSession();

  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, organizationId: session.user.organizationId },
  });
  if (!collection) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(collection.clientId, session.user.role, editableClientIds)) return;
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const postIds = formData.getAll("postIds").filter((v): v is string => typeof v === "string");
  if (postIds.length === 0) return;

  const posts = await prisma.contentPost.findMany({
    where: {
      id: { in: postIds },
      organizationId: session.user.organizationId,
      ...postClientScopeFilter(accessibleClientIds),
    },
    select: { id: true },
  });

  await prisma.collectionItem.createMany({
    data: posts.map((post) => ({ collectionId, contentPostId: post.id })),
  });

  revalidatePath(`/colecoes/${collectionId}`);
}

export async function addCollectionIdeasAction(collectionId: string, formData: FormData) {
  const session = await requireSession();

  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, organizationId: session.user.organizationId },
  });
  if (!collection) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(collection.clientId, session.user.role, editableClientIds)) return;
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const ideaIds = formData.getAll("ideaIds").filter((v): v is string => typeof v === "string");
  if (ideaIds.length === 0) return;

  const ideas = await prisma.contentIdea.findMany({
    where: {
      id: { in: ideaIds },
      organizationId: session.user.organizationId,
      ...clientScopeFilter(accessibleClientIds),
    },
    select: { id: true },
  });

  await prisma.collectionItem.createMany({
    data: ideas.map((idea) => ({ collectionId, contentIdeaId: idea.id })),
  });

  revalidatePath(`/colecoes/${collectionId}`);
}

export async function addPostToCollectionsAction(postId: string, formData: FormData) {
  const session = await requireSession();

  const post = await prisma.contentPost.findFirst({
    where: { id: postId, organizationId: session.user.organizationId },
    include: { referenceProfile: { select: { clientId: true } } },
  });
  if (!post) return;

  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);
  const postClientId = post.referenceProfile?.clientId ?? null;

  const collectionIds = formData
    .getAll("collectionIds")
    .filter((v): v is string => typeof v === "string");
  if (collectionIds.length === 0) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);

  const collections = await prisma.collection.findMany({
    where: {
      id: { in: collectionIds },
      organizationId: session.user.organizationId,
      ...clientScopeFilter(accessibleClientIds),
    },
  });

  const targetCollectionIds = collections
    .filter((c) => canEditClient(c.clientId, session.user.role, editableClientIds))
    .filter((c) => c.clientId === null || c.clientId === postClientId)
    .map((c) => c.id);
  if (targetCollectionIds.length === 0) return;

  await prisma.collectionItem.createMany({
    data: targetCollectionIds.map((collectionId) => ({ collectionId, contentPostId: post.id })),
    skipDuplicates: true,
  });

  revalidatePath(`/banco-de-conteudos/${postId}`);
  for (const collectionId of targetCollectionIds) {
    revalidatePath(`/colecoes/${collectionId}`);
  }
}

export async function removeCollectionItemAction(collectionId: string, itemId: string) {
  const session = await requireSession();

  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, organizationId: session.user.organizationId },
  });
  if (!collection) return;

  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);
  if (!canEditClient(collection.clientId, session.user.role, editableClientIds)) return;

  await prisma.collectionItem.delete({ where: { id: itemId } });
  revalidatePath(`/colecoes/${collectionId}`);
}
