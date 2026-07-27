import { PageHeader } from "@/components/layout/page-header";
import { CollectionForm } from "@/components/collections/collection-form";
import { createCollectionAction } from "@/server/actions/collections";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, clientIdInFilter } from "@/lib/client-access";

export default async function NovaColecaoPage() {
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
        title="Nova coleção"
        description="Crie uma coleção para organizar posts e ideias salvos."
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <CollectionForm action={createCollectionAction} clients={clients} submitLabel="Criar coleção" />
        </CardContent>
      </Card>
    </div>
  );
}
