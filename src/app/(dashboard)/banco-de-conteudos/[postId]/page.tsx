import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, canAccessClient, clientScopeFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { networkLabels, formatLabels } from "@/lib/reference-profile-labels";
import { addPostToCollectionsAction } from "@/server/actions/collections";
import { mediaProxyUrl } from "@/lib/media-proxy";

export default async function ContentPostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const post = await prisma.contentPost.findFirst({
    where: { id: postId, organizationId: session.user.organizationId },
    include: { referenceProfile: { include: { client: { select: { name: true } } } } },
  });

  if (!post) notFound();
  if (!canAccessClient(post.referenceProfile?.clientId ?? null, accessibleClientIds)) notFound();

  const postClientId = post.referenceProfile?.clientId ?? null;
  const collections = await prisma.collection.findMany({
    where: {
      organizationId: session.user.organizationId,
      OR: [{ clientId: null }, { clientId: postClientId }],
      ...clientScopeFilter(accessibleClientIds),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const boundAddToCollections = addPostToCollectionsAction.bind(null, post.id);

  const mediaUrls = Array.isArray(post.mediaUrls) ? (post.mediaUrls as string[]) : [];
  const isVideo = post.format === "VIDEO_SHORT" || post.format === "VIDEO_LONG";
  const videoUrl = isVideo ? mediaUrls.find((url) => url.includes(".mp4")) ?? mediaUrls[mediaUrls.length - 1] : undefined;
  const imageUrl = mediaUrls.find((url) => !url.includes(".mp4")) ?? mediaUrls[0];

  return (
    <div>
      <PageHeader
        title={`@${post.referenceProfile?.handle ?? post.authorHandle}`}
        description="Visualização simulada do conteúdo capturado, com indicadores de performance."
        actions={
          post.permalink ? (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <ExternalLink className="size-4" />
              Ver no {networkLabels[post.network]}
            </a>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden py-0">
            <div className="relative flex max-h-[720px] w-full items-center justify-center bg-black">
              {isVideo && videoUrl ? (
                <video
                  controls
                  poster={imageUrl ? mediaProxyUrl(imageUrl) : undefined}
                  src={mediaProxyUrl(videoUrl)}
                  className="max-h-[720px] w-full"
                />
              ) : imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaProxyUrl(imageUrl)}
                  alt={post.caption ?? "Conteúdo"}
                  className="max-h-[720px] w-full object-contain"
                />
              ) : (
                <div className="flex h-64 w-full items-center justify-center text-sm text-muted-foreground">
                  Sem mídia disponível.
                </div>
              )}
            </div>
            <CardContent className="py-4">
              <p className="whitespace-pre-wrap text-sm">{post.caption ?? "Sem legenda."}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Indicadores de performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Curtidas</span>
                <span className="font-medium">{post.likes.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Comentários</span>
                <span className="font-medium">{post.comments.toLocaleString("pt-BR")}</span>
              </div>
              {post.views != null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Visualizações</span>
                  <span className="font-medium">{post.views.toLocaleString("pt-BR")}</span>
                </div>
              )}
              {post.authorFollowers != null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Seguidores do perfil</span>
                  <span className="font-medium">{post.authorFollowers.toLocaleString("pt-BR")}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-muted-foreground">Engajamento</span>
                <span className="font-medium">{(post.engagementRate * 100).toFixed(2)}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{networkLabels[post.network]}</Badge>
                <Badge variant="outline">{formatLabels[post.format]}</Badge>
              </div>
              <p className="text-muted-foreground">
                Publicado em{" "}
                {post.publishedAt ? post.publishedAt.toLocaleDateString("pt-BR") : "data desconhecida"}
              </p>
              {post.referenceProfile && (
                <p>
                  Perfil:{" "}
                  <Link href={`/perfis/${post.referenceProfile.id}`} className="hover:underline">
                    @{post.referenceProfile.handle}
                  </Link>
                </p>
              )}
              {post.referenceProfile?.client && (
                <p className="text-muted-foreground">Cliente: {post.referenceProfile.client.name}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Salvar em coleção</CardTitle>
            </CardHeader>
            <CardContent>
              {collections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma coleção disponível. Crie uma coleção primeiro.
                </p>
              ) : (
                <form action={boundAddToCollections} className="space-y-3">
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {collections.map((collection) => (
                      <label
                        key={collection.id}
                        className="flex items-center gap-2 rounded-md border p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="collectionIds"
                          value={collection.id}
                          className="size-4"
                        />
                        {collection.name}
                      </label>
                    ))}
                  </div>
                  <Button type="submit" size="sm">
                    Adicionar à coleção
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
