import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, canAccessClient } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { KnowledgeItemForm, typeLabels } from "@/components/clients/knowledge-item-form";
import {
  addKnowledgeItemAction,
  deleteKnowledgeItemAction,
  updateClientAction,
} from "@/server/actions/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink, UserSearch, FileEdit } from "lucide-react";
import { networkLabels, frequencyLabels } from "@/lib/reference-profile-labels";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const session = await requireSession();

  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: session.user.organizationId },
    include: {
      knowledgeItems: { orderBy: { createdAt: "desc" } },
      referenceProfiles: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { contentPosts: true } } },
      },
      contentImprovements: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) notFound();

  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);
  if (!canAccessClient(client.id, accessibleClientIds)) notFound();

  const boundUpdate = updateClientAction.bind(null, client.id);
  const boundAddKnowledge = addKnowledgeItemAction.bind(null, client.id);

  return (
    <div>
      <PageHeader title={client.name} description={client.segment ?? undefined} />

      <Tabs defaultValue="perfil" className="max-w-3xl">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="conhecimento">
            Base de conhecimento
            {client.knowledgeItems.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {client.knowledgeItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="perfis">
            Perfis monitorados
            {client.referenceProfiles.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {client.referenceProfiles.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="melhorias">
            Análises de conteúdo
            {client.contentImprovements.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {client.contentImprovements.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <Card>
            <CardContent className="pt-6">
              <ClientForm
                action={boundUpdate}
                submitLabel="Salvar alterações"
                defaultValues={{
                  name: client.name,
                  segment: client.segment,
                  businessSummary: client.businessSummary,
                  targetAudience: client.targetAudience,
                  toneOfVoice: client.toneOfVoice,
                  contentPillars: client.contentPillars,
                  restrictions: client.restrictions,
                  status: client.status,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conhecimento" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adicionar item</CardTitle>
            </CardHeader>
            <CardContent>
              <KnowledgeItemForm action={boundAddKnowledge} />
            </CardContent>
          </Card>

          {client.knowledgeItems.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Nenhum item na base de conhecimento ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {client.knowledgeItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex items-start justify-between gap-4 pt-6">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium">{item.title}</span>
                        <Badge variant="outline">{typeLabels[item.type]}</Badge>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {item.content}
                      </p>
                    </div>
                    <form
                      action={deleteKnowledgeItemAction.bind(null, client.id, item.id)}
                    >
                      <Button variant="ghost" size="icon" type="submit">
                        <Trash2 className="size-4" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="perfis" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href={`/perfis/novo?clientId=${client.id}`} />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Cadastrar perfil manualmente
            </Button>
            <Button
              render={<Link href="/descobrir-criadores/nova" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              <UserSearch className="size-4" />
              Descobrir novos criadores
            </Button>
          </div>

          {client.referenceProfiles.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Nenhum perfil monitorado para este cliente ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {client.referenceProfiles.map((profile) => (
                <Card key={profile.id}>
                  <CardContent className="pt-6">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Link href={`/perfis/${profile.id}`} className="font-medium hover:underline">
                        @{profile.handle}
                      </Link>
                      <a
                        href={profile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {networkLabels[profile.network]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {frequencyLabels[profile.scrapeFrequency]}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {profile._count.contentPosts} posts coletados
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="melhorias" className="space-y-4">
          <Button
            render={<Link href="/melhorar-conteudo/nova" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <FileEdit className="size-4" />
            Nova análise de conteúdo
          </Button>

          {client.contentImprovements.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Nenhuma análise de conteúdo para este cliente ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {client.contentImprovements.map((improvement) => (
                <Card key={improvement.id}>
                  <CardContent className="pt-6">
                    <Link
                      href={`/melhorar-conteudo/${improvement.id}`}
                      className="font-medium hover:underline"
                    >
                      {improvement.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {improvement.sourceType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {improvement.createdAt.toLocaleDateString("pt-BR")}
                      </span>
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
