import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, canAccessClient, clientIdInFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { ReferenceProfileForm } from "@/components/reference-profiles/reference-profile-form";
import {
  updateReferenceProfileAction,
  deleteReferenceProfileAction,
  triggerScrapeAction,
} from "@/server/actions/reference-profiles";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";

const jobStatusLabels: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pendente", variant: "outline" },
  RUNNING: { label: "Em andamento", variant: "secondary" },
  SUCCESS: { label: "Concluído", variant: "default" },
  FAILED: { label: "Falhou", variant: "destructive" },
};

export default async function PerfilDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const [profile, clients] = await Promise.all([
    prisma.referenceProfile.findFirst({
      where: { id: profileId, organizationId: session.user.organizationId },
      include: {
        scrapeJobs: { orderBy: { createdAt: "desc" }, take: 10 },
        contentPosts: { orderBy: { publishedAt: "desc" }, take: 12 },
      },
    }),
    prisma.client.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...clientIdInFilter(accessibleClientIds),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!profile) notFound();
  if (!canAccessClient(profile.clientId, accessibleClientIds)) notFound();

  const boundUpdate = updateReferenceProfileAction.bind(null, profile.id);
  const boundDelete = deleteReferenceProfileAction.bind(null, profile.id);
  const boundTriggerScrape = triggerScrapeAction.bind(null, profile.id);

  const hasActiveJob = profile.scrapeJobs.some(
    (job) => job.status === "PENDING" || job.status === "RUNNING"
  );
  const canScrape = profile.network === "INSTAGRAM";

  return (
    <div>
      <PageHeader
        title={`@${profile.handle}`}
        description={profile.category ?? undefined}
        actions={
          <div className="flex gap-2">
            <form action={boundTriggerScrape}>
              <Button type="submit" variant="outline" disabled={hasActiveJob || !canScrape}>
                <RefreshCw className={hasActiveJob ? "animate-spin" : undefined} />
                {hasActiveJob ? "Coletando..." : "Buscar agora"}
              </Button>
            </form>
            <form action={boundDelete}>
              <Button type="submit" variant="ghost" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </form>
          </div>
        }
      />

      {!canScrape && (
        <p className="mb-4 text-sm text-muted-foreground">
          Scraping automático disponível apenas para Instagram no momento. Este perfil pode ser
          usado para acompanhamento manual.
        </p>
      )}

      <Tabs defaultValue="perfil" className="max-w-4xl">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="historico">
            Histórico de coletas
            {profile.scrapeJobs.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {profile.scrapeJobs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="posts">
            Posts coletados
            {profile.contentPosts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {profile.contentPosts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <Card>
            <CardContent className="pt-6">
              <ReferenceProfileForm
                action={boundUpdate}
                clients={clients}
                submitLabel="Salvar alterações"
                defaultValues={{
                  network: profile.network,
                  handle: profile.handle,
                  url: profile.url,
                  category: profile.category,
                  scrapeFrequency: profile.scrapeFrequency,
                  clientId: profile.clientId,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-3">
          {profile.scrapeJobs.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Nenhuma coleta realizada ainda.
            </div>
          ) : (
            profile.scrapeJobs.map((job) => (
              <Card key={job.id}>
                <CardContent className="flex items-center justify-between gap-4 pt-6">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={jobStatusLabels[job.status].variant}>
                        {jobStatusLabels[job.status].label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {job.createdAt.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {job.status === "SUCCESS" && (
                      <p className="text-sm text-muted-foreground">
                        {job.postsCollected} posts coletados
                      </p>
                    )}
                    {job.status === "FAILED" && job.errorMessage && (
                      <p className="text-sm text-destructive">{job.errorMessage}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="posts">
          {profile.contentPosts.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Nenhum post coletado ainda. Use &quot;Buscar agora&quot; para iniciar uma coleta.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.contentPosts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="pt-6">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline">{post.format}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {post.publishedAt ? post.publishedAt.toLocaleDateString("pt-BR") : "—"}
                      </span>
                    </div>
                    <p className="mb-3 line-clamp-3 text-sm text-muted-foreground">
                      {post.caption ?? "Sem legenda"}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{post.likes} curtidas</span>
                      <span>{post.comments} comentários</span>
                      {post.views != null && <span>{post.views} views</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
