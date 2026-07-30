import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, canAccessClient } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { deleteMarketResearchAction } from "@/server/actions/market-research";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink } from "lucide-react";

export default async function MarketResearchDetailPage({
  params,
}: {
  params: Promise<{ researchId: string }>;
}) {
  const { researchId } = await params;
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const research = await prisma.marketResearch.findFirst({
    where: { id: researchId, organizationId: session.user.organizationId },
    include: { client: { select: { name: true } } },
  });

  if (!research) notFound();
  if (!canAccessClient(research.clientId, accessibleClientIds)) notFound();

  const trendingFormats = Array.isArray(research.trendingFormats)
    ? (research.trendingFormats as string[])
    : [];
  const recurringHooks = Array.isArray(research.recurringHooks)
    ? (research.recurringHooks as string[])
    : [];
  const referenceAccounts = Array.isArray(research.referenceAccounts)
    ? (research.referenceAccounts as { label?: string; note?: string; network?: string; url?: string }[])
    : [];
  const sources = Array.isArray(research.sources)
    ? (research.sources as { title?: string; url?: string }[])
    : [];

  const boundDelete = deleteMarketResearchAction.bind(null, research.id);

  return (
    <div>
      <PageHeader
        title={research.theme}
        description={research.client?.name ?? undefined}
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
              <CardTitle className="text-base">Síntese</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{research.summary}</p>
            </CardContent>
          </Card>

          {sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fontes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sources.map((source, i) => (
                  <a
                    key={i}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    <ExternalLink className="size-3.5 shrink-0" />
                    <span className="truncate">{source.title ?? source.url}</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Formatos em alta</CardTitle>
            </CardHeader>
            <CardContent>
              {trendingFormats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum formato identificado.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trendingFormats.map((format, i) => (
                    <Badge key={i} variant="outline">
                      {format}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ganchos recorrentes</CardTitle>
            </CardHeader>
            <CardContent>
              {recurringHooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum gancho identificado.</p>
              ) : (
                <ul className="list-disc space-y-1.5 pl-4 text-sm">
                  {recurringHooks.map((hook, i) => (
                    <li key={i}>{hook}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contas de referência</CardTitle>
            </CardHeader>
            <CardContent>
              {referenceAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conta identificada.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  {referenceAccounts.map((account, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-1.5">
                        {account.url ? (
                          <a
                            href={account.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 font-medium hover:underline"
                          >
                            {account.label}
                            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                          </a>
                        ) : (
                          <p className="font-medium">{account.label}</p>
                        )}
                        {account.network && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {account.network}
                          </Badge>
                        )}
                      </div>
                      {account.note && <p className="text-xs text-muted-foreground">{account.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
