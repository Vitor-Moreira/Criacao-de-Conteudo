import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, clientScopeFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

export default async function PesquisaMercadoPage() {
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const researches = await prisma.marketResearch.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...clientScopeFilter(accessibleClientIds),
    },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Pesquisa de Mercado"
        description="Relatório de tendências por tema, combinando o banco de conteúdos coletado, busca na web e síntese via Claude."
        actions={
          <Button render={<Link href="/pesquisa-mercado/nova" />} nativeButton={false}>
            <Plus />
            Nova pesquisa
          </Button>
        }
      />

      {researches.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhuma pesquisa gerada ainda.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tema</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {researches.map((research) => (
                <TableRow key={research.id}>
                  <TableCell className="font-medium">
                    <Link href={`/pesquisa-mercado/${research.id}`} className="hover:underline">
                      {research.theme}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {research.client?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {research.createdAt.toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
