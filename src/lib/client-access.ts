import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/client";

/**
 * Política de acesso por cliente (ClientAccess):
 *
 * - OWNER: acesso total de leitura e escrita a todos os clientes e conteúdos
 *   da organização, sempre.
 * - Conteúdo "org-wide" (clientId = null, ex: perfil de referência ou ideia
 *   ainda não associada a um cliente): visível para qualquer membro da
 *   organização. Edição permitida para OWNER e MEMBER; CLIENT não edita
 *   conteúdo org-wide (papel de visualização restrita).
 * - Conteúdo associado a um cliente (clientId definido): MEMBER/CLIENT só
 *   enxergam se existir um registro ClientAccess para aquele userId+clientId;
 *   só editam se esse registro tiver canEdit = true.
 */

export async function getAccessibleClientIds(
  userId: string,
  role: Role
): Promise<string[] | null> {
  if (role === "OWNER") return null;

  const access = await prisma.clientAccess.findMany({
    where: { userId },
    select: { clientId: true },
  });

  return access.map((a) => a.clientId);
}

export async function getEditableClientIds(
  userId: string,
  role: Role
): Promise<string[] | null> {
  if (role === "OWNER") return null;

  const access = await prisma.clientAccess.findMany({
    where: { userId, canEdit: true },
    select: { clientId: true },
  });

  return access.map((a) => a.clientId);
}

/** Filtro Prisma para modelos com `clientId` nullable direto (Collection, ContentIdea, MarketResearch, ReferenceProfile, GeneratedAsset). */
export function clientScopeFilter(accessibleClientIds: string[] | null) {
  if (accessibleClientIds === null) return {};
  return {
    OR: [{ clientId: null }, { clientId: { in: accessibleClientIds } }],
  };
}

/** Filtro Prisma para o próprio modelo `Client`. */
export function clientIdInFilter(accessibleClientIds: string[] | null) {
  if (accessibleClientIds === null) return {};
  return { id: { in: accessibleClientIds } };
}

/** Filtro Prisma para ContentPost, cujo clientId vem via referenceProfile. */
export function postClientScopeFilter(accessibleClientIds: string[] | null) {
  if (accessibleClientIds === null) return {};
  return {
    OR: [
      { referenceProfileId: null },
      { referenceProfile: { clientId: null } },
      { referenceProfile: { clientId: { in: accessibleClientIds } } },
    ],
  };
}

/** Verifica se o usuário pode LER um registro com o clientId dado (null = org-wide). */
export function canAccessClient(
  clientId: string | null,
  accessibleClientIds: string[] | null
): boolean {
  if (accessibleClientIds === null) return true; // OWNER
  if (clientId === null) return true; // org-wide, visível a todos
  return accessibleClientIds.includes(clientId);
}

/** Verifica se o usuário pode EDITAR um registro com o clientId dado (null = org-wide). */
export function canEditClient(
  clientId: string | null,
  role: Role,
  editableClientIds: string[] | null
): boolean {
  if (editableClientIds === null) return true; // OWNER
  if (clientId === null) return role !== "CLIENT";
  return editableClientIds.includes(clientId);
}
