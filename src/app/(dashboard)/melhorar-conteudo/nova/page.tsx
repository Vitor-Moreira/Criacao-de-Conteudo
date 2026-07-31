import { PageHeader } from "@/components/layout/page-header";
import { ContentImprovementForm } from "@/components/content-improvement/content-improvement-form";
import { createContentImprovementAction } from "@/server/actions/content-improvement";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getEditableClientIds, clientIdInFilter } from "@/lib/client-access";

export default async function NovaMelhoriaConteudoPage() {
  const session = await requireSession();
  const editableClientIds = await getEditableClientIds(session.user.id, session.user.role);

  const clients = await prisma.client.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...clientIdInFilter(editableClientIds),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader
        title="Nova análise de conteúdo"
        description="Cole um texto ou envie um arquivo (PDF, DOCX ou XLSX) com um conteúdo já planejado para a IA analisar e sugerir melhorias, respeitando o briefing do cliente quando informado."
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ContentImprovementForm action={createContentImprovementAction} clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
