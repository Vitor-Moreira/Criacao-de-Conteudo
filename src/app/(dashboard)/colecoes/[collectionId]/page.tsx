import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  getAccessibleClientIds,
  canAccessClient,
  clientScopeFilter,
  postClientScopeFilter,
} from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import {
  deleteCollectionAction,
  updateCollectionAction,
  addCollectionPostsAction,
  addCollectionIdeasAction,
  removeCollectionItemAction,
} from "@/server/actions/collections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";
import { CollectionNameEditor } from "@/components/collections/collection-name-editor";
import { ideaStatusLabels, ideaStatusBadgeClass } from "@/lib/content-idea-labels";

export default async function ColecaoDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, organizationId: session.user.organizationId },
    include: {
      client: { select: { name: true } },
      items: {
        include: { contentPost: true, contentIdea: true },
        orderBy: { addedAt: "desc" },
      },
    },
  });

  if (!collection) notFound();
  if (!canAccessClient(collection.clientId, accessibleClientIds)) notFound();

  const excludePostIds = collection.items
    .filter((item) => item.contentPostId)
    .map((item) => item.contentPostId!);
  const excludeIdeaIds = collection.items
    .filter((item) => item.contentIdeaId)
    .map((item) => item.contentIdeaId!);

  const [candidatePosts, candidateIdeas] = await Promise.all([
    prisma.contentPost.findMany({
      where: {
        organizationId: session.user.organizationId,
        id: { notIn: excludePostIds.length > 0 ? excludePostIds : undefined },
        ...(collection.clientId ? { referenceProfile: { clientId: collection.clientId } } : {}),
        ...postClientScopeFilter(accessibleClientIds),
      },
      orderBy: { publishedAt: "desc" },
      take: 30,
    }),
    prisma.contentIdea.findMany({
      where: {
        organizationId: session.user.organizationId,
        id: { notIn: excludeIdeaIds.length > 0 ? excludeIdeaIds : undefined },
        ...(collection.clientId ? { clientId: collection.clientId } : {}),
        ...clientScopeFilter(accessibleClientIds),
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const boundDelete = deleteCollectionAction.bind(null, collection.id);
  const boundAddPosts = addCollectionPostsAction.bind(null, collection.id);
  const boundAddIdeas = addCollectionIdeasAction.bind(null, collection.id);

  return (
    <div>
      <PageHeader
        title={
          <CollectionNameEditor
            collectionId={collection.id}
            name={collection.name}
            action={updateCollectionAction}
          />
        }
        description={collection.client?.name ?? undefined}
        actions={
          <form action={boundDelete}>
            <Button type="submit" variant="ghost" size="icon">
              <Trash2 className="size-4" />
            </Button>
          </form>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens salvos ({collection.items.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {collection.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item salvo ainda.</p>
              ) : (
                collection.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <div className="min-w-0">
                      {item.contentPost && (
                        <>
                          <div className="mb-1 flex items-center gap-2">
                            <Badge variant="outline">Post</Badge>
                            <Link
                              href={`/perfis/${item.contentPost.referenceProfileId ?? ""}`}
                              className="text-xs font-medium hover:underline"
                            >
                              @{item.contentPost.authorHandle}
                            </Link>
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {item.contentPost.caption ?? "Sem legenda"}
                          </p>
                        </>
                      )}
                      {item.contentIdea && (
                        <>
                          <div className="mb-1 flex items-center gap-2">
                            <Badge variant="outline">Ideia</Badge>
                            <Link
                              href={`/estudio/${item.contentIdea.id}`}
                              className="text-xs font-medium hover:underline"
                            >
                              {item.contentIdea.title}
                            </Link>
                            <Badge className={ideaStatusBadgeClass[item.contentIdea.status]}>
                              {ideaStatusLabels[item.contentIdea.status]}
                            </Badge>
                          </div>
                        </>
                      )}
                    </div>
                    <form action={removeCollectionItemAction.bind(null, collection.id, item.id)}>
                      <Button type="submit" variant="ghost" size="icon" className="size-6 shrink-0">
                        <X className="size-3" />
                      </Button>
                    </form>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adicionar posts</CardTitle>
            </CardHeader>
            <CardContent>
              {candidatePosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum post disponível para adicionar.
                </p>
              ) : (
                <form action={boundAddPosts} className="space-y-3">
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {candidatePosts.map((post) => (
                      <label
                        key={post.id}
                        className="flex items-start gap-2 rounded-md border p-2 text-xs"
                      >
                        <input type="checkbox" name="postIds" value={post.id} className="mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium">@{post.authorHandle}</p>
                          <p className="line-clamp-2 text-muted-foreground">
                            {post.caption ?? "Sem legenda"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <Button type="submit" size="sm">
                    Adicionar selecionados
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adicionar ideias</CardTitle>
            </CardHeader>
            <CardContent>
              {candidateIdeas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma ideia disponível para adicionar.
                </p>
              ) : (
                <form action={boundAddIdeas} className="space-y-3">
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {candidateIdeas.map((idea) => (
                      <label
                        key={idea.id}
                        className="flex items-start gap-2 rounded-md border p-2 text-xs"
                      >
                        <input type="checkbox" name="ideaIds" value={idea.id} className="mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium">{idea.title}</p>
                          <p className="line-clamp-2 text-muted-foreground">
                            {idea.theme ?? "Sem tema"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <Button type="submit" size="sm">
                    Adicionar selecionadas
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
