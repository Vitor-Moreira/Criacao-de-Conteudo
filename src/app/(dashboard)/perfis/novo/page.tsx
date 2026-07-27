import { PageHeader } from "@/components/layout/page-header";
import { ReferenceProfileForm } from "@/components/reference-profiles/reference-profile-form";
import { createReferenceProfileAction } from "@/server/actions/reference-profiles";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, clientIdInFilter } from "@/lib/client-access";

export default async function NovoPerfilPage() {
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
        title="Novo perfil de referência"
        description="Cadastre um perfil para monitorar e coletar conteúdos via scraping."
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ReferenceProfileForm
            action={createReferenceProfileAction}
            clients={clients}
            submitLabel="Criar perfil"
          />
        </CardContent>
      </Card>
    </div>
  );
}
