import { PageHeader } from "@/components/layout/page-header";
import { CreatorDiscoveryForm } from "@/components/creator-discovery/creator-discovery-form";
import { createCreatorDiscoveryAction } from "@/server/actions/creator-discovery";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, clientIdInFilter } from "@/lib/client-access";

export default async function NovaBuscaCriadoresPage() {
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
        title="Nova busca de criadores"
        description="Informe um tema para encontrar, via IA e busca na web, os perfis mais relevantes e engajados sobre o assunto. Pode levar alguns segundos."
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <CreatorDiscoveryForm action={createCreatorDiscoveryAction} clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
