import { PageHeader } from "@/components/layout/page-header";
import { MarketResearchForm } from "@/components/market-research/market-research-form";
import { createMarketResearchAction } from "@/server/actions/market-research";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, clientIdInFilter } from "@/lib/client-access";

export default async function NovaPesquisaMercadoPage() {
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const clients = await prisma.client.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...clientIdInFilter(accessibleClientIds),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader
        title="Nova pesquisa de mercado"
        description="Informe um tema para pesquisar tendências na web e cruzar com o banco de conteúdos. Pode levar alguns segundos."
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <MarketResearchForm action={createMarketResearchAction} clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
