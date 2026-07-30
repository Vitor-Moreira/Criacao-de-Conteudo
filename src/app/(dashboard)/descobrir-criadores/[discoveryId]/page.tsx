import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, canAccessClient, clientIdInFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import {
  deleteCreatorDiscoveryAction,
  addDiscoveredCreatorsAction,
  type CreatorResult,
} from "@/server/actions/creator-discovery";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink } from "lucide-react";
import { networkLabels } from "@/lib/reference-profile-labels";

export default async function CreatorDiscoveryDetailPage({
  params,
}: {
  params: Promise<{ discoveryId: string }>;
}) {
  const { discoveryId } = await params;
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const discovery = await prisma.creatorDiscovery.findFirst({
    where: { id: discoveryId, organizationId: session.user.organizationId },
    include: { client: { select: { name: true } } },
  });

  if (!discovery) notFound();
  if (!canAccessClient(discovery.clientId, accessibleClientIds)) notFound();

  const results = discovery.results as { creators?: CreatorResult[]; error?: string } | null;
  const creators = Array.isArray(results?.creators) ? results.creators : [];
  const errorMessage = typeof results?.error === "string" ? results.error : null;

  const clients = await prisma.client.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...clientIdInFilter(accessibleClientIds),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const boundDelete = deleteCreatorDiscoveryAction.bind(null, discovery.id);
  const boundAdd = addDiscoveredCreatorsAction.bind(null, discovery.id);

  return (
    <div>
      <PageHeader
        title={discovery.theme}
        description={discovery.client?.name ?? undefined}
        actions={
          <form action={boundDelete}>
            <Button type="submit" variant="ghost" size="icon">
              <Trash2 className="size-4" />
            </Button>
          </form>
        }
      />

      {errorMessage ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-destructive">
          Erro ao buscar criadores: {errorMessage}
        </div>
      ) : creators.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhum criador encontrado para esse tema.
        </div>
      ) : (
        <form action={boundAdd} className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-6">
              <div className="flex flex-col gap-1">
                <label htmlFor="clientId" className="text-xs font-medium text-muted-foreground">
                  Associar selecionados ao cliente
                </label>
                <select
                  id="clientId"
                  name="clientId"
                  defaultValue={discovery.clientId ?? "none"}
                  className="h-8 w-56 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="none">Nenhum — monitoramento geral</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm">
                Adicionar selecionados aos Perfis de Referência
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((creator, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 pt-6">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      name="creator"
                      value={JSON.stringify(creator)}
                      className="mt-1 size-4"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={creator.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 truncate font-medium hover:underline"
                        >
                          {creator.handle}
                          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                        </a>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {networkLabels[creator.network] ?? creator.network}
                        </Badge>
                        {creator.followersEstimate && (
                          <span className="text-xs text-muted-foreground">
                            {creator.followersEstimate}
                          </span>
                        )}
                      </div>
                      {creator.note && (
                        <p className="mt-1.5 text-xs text-muted-foreground">{creator.note}</p>
                      )}
                    </div>
                  </label>
                </CardContent>
              </Card>
            ))}
          </div>
        </form>
      )}
    </div>
  );
}
