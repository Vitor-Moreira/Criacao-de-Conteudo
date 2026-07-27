import { PageHeader } from "@/components/layout/page-header";
import { ContentIdeaForm } from "@/components/content-ideas/content-idea-form";
import { createContentIdeaAction } from "@/server/actions/content-ideas";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, clientIdInFilter } from "@/lib/client-access";

export default async function NovaIdeiaPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; clientId?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
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
        title="Nova ideia de conteúdo"
        description="Cadastre uma ideia para depois gerar roteiros, copies e conceitos com IA."
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ContentIdeaForm
            action={createContentIdeaAction}
            clients={clients}
            submitLabel="Criar ideia"
            defaultValues={{ theme: params.theme, clientId: params.clientId }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
