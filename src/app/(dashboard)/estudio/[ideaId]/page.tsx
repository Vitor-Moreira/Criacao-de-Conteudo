import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, canAccessClient, postClientScopeFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import {
  deleteContentIdeaAction,
  updateContentIdeaAction,
  deleteGeneratedAssetAction,
  addSourcePostsAction,
  removeSourcePostAction,
  generateAssetAction,
  updateContentIdeaScheduleAction,
} from "@/server/actions/content-ideas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";
import { assetTypeLabels, ideaStatusLabels, ideaStatusBadgeClass } from "@/lib/content-idea-labels";
import { ContentIdeaEditor } from "@/components/content-ideas/content-idea-editor";

export default async function IdeiaDetailPage({
  params,
}: {
  params: Promise<{ ideaId: string }>;
}) {
  const { ideaId } = await params;
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const idea = await prisma.contentIdea.findFirst({
    where: { id: ideaId, organizationId: session.user.organizationId },
    include: {
      client: { select: { name: true } },
      sourcePosts: { include: { post: true }, orderBy: { post: { publishedAt: "desc" } } },
      generatedAssets: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!idea) notFound();
  if (!canAccessClient(idea.clientId, accessibleClientIds)) notFound();

  const excludeIds = idea.sourcePosts.map((sp) => sp.postId);

  const candidatePosts = await prisma.contentPost.findMany({
    where: {
      organizationId: session.user.organizationId,
      id: { notIn: excludeIds.length > 0 ? excludeIds : undefined },
      ...(idea.clientId ? { referenceProfile: { clientId: idea.clientId } } : {}),
      ...postClientScopeFilter(accessibleClientIds),
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  const boundDelete = deleteContentIdeaAction.bind(null, idea.id);
  const boundAddSourcePosts = addSourcePostsAction.bind(null, idea.id);
  const boundGenerate = generateAssetAction.bind(null, idea.id);
  const boundUpdateSchedule = updateContentIdeaScheduleAction.bind(null, idea.id);

  return (
    <div>
      <PageHeader
        title={idea.title}
        description={idea.theme ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge className={ideaStatusBadgeClass[idea.status]}>
              {ideaStatusLabels[idea.status]}
            </Badge>
            <form action={boundDelete}>
              <Button type="submit" variant="ghost" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </form>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Briefing</CardTitle>
              <ContentIdeaEditor
                ideaId={idea.id}
                title={idea.title}
                theme={idea.theme}
                description={idea.description}
                action={updateContentIdeaAction}
              />
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Cliente: </span>
                {idea.client?.name ?? "Nenhum"}
              </p>
              <p className="whitespace-pre-wrap">{idea.description ?? "Sem descrição."}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gerar conteúdo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                A geração usa o briefing acima, os dados do cliente e os posts de referência
                selecionados. Pode levar alguns segundos.
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(assetTypeLabels) as Array<keyof typeof assetTypeLabels>).map((type) => (
                  <form key={type} action={boundGenerate}>
                    <input type="hidden" name="type" value={type} />
                    <Button type="submit" variant="outline">
                      {assetTypeLabels[type]}
                    </Button>
                  </form>
                ))}
              </div>
            </CardContent>
          </Card>

          {idea.generatedAssets.length > 0 && (
            <div className="space-y-3">
              {idea.generatedAssets.map((asset) => (
                <Card key={asset.id}>
                  <CardContent className="pt-6">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge>{assetTypeLabels[asset.type]}</Badge>
                        <span className="text-xs text-muted-foreground">v{asset.version}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {asset.brandFitScore != null && (
                          <Badge variant="outline">Fit de marca: {asset.brandFitScore}/100</Badge>
                        )}
                        <form action={deleteGeneratedAssetAction.bind(null, idea.id, asset.id)}>
                          <Button type="submit" variant="ghost" size="icon" className="size-6 shrink-0">
                            <Trash2 className="size-3" />
                          </Button>
                        </form>
                      </div>
                    </div>
                    <p className="mb-2 whitespace-pre-wrap text-sm">{asset.content}</p>
                    {asset.brandFitJustification && (
                      <p className="text-xs text-muted-foreground">
                        {asset.brandFitJustification}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status e agendamento</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={boundUpdateSchedule} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={idea.status}
                    className="h-8 w-40 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {(Object.keys(ideaStatusLabels) as Array<keyof typeof ideaStatusLabels>).map((key) => (
                      <option key={key} value={key}>
                        {ideaStatusLabels[key]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="scheduledDate" className="text-xs font-medium text-muted-foreground">
                    Data agendada
                  </label>
                  <input
                    id="scheduledDate"
                    name="scheduledDate"
                    type="date"
                    defaultValue={idea.scheduledDate ? idea.scheduledDate.toISOString().slice(0, 10) : ""}
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
                <button
                  type="submit"
                  className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Salvar
                </button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Posts de referência ({idea.sourcePosts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {idea.sourcePosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum post selecionado.</p>
              ) : (
                idea.sourcePosts.map((sp) => (
                  <div
                    key={sp.postId}
                    className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">@{sp.post.authorHandle}</p>
                      <p className="line-clamp-2 text-muted-foreground">
                        {sp.post.caption ?? "Sem legenda"}
                      </p>
                    </div>
                    <form action={removeSourcePostAction.bind(null, idea.id, sp.postId)}>
                      <Button type="submit" variant="ghost" size="icon" className="size-6 shrink-0">
                        <X className="size-3" />
                      </Button>
                    </form>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adicionar do banco de conteúdos</CardTitle>
            </CardHeader>
            <CardContent>
              {candidatePosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum post disponível para adicionar.
                </p>
              ) : (
                <form action={boundAddSourcePosts} className="space-y-3">
                  <div className="max-h-80 space-y-2 overflow-y-auto">
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
        </div>
      </div>
    </div>
  );
}
