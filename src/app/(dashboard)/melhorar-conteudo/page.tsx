import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, clientScopeFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

const sourceTypeLabels: Record<string, string> = {
  TEXT: "Texto",
  PDF: "PDF",
  DOCX: "DOCX",
  XLSX: "XLSX",
};

export default async function MelhorarConteudoPage() {
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const improvements = await prisma.contentImprovement.findMany({
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
        title="Melhorar Conteúdo"
        description="Envie um texto, PDF, DOCX ou planilha com um conteúdo já planejado para a IA analisar e sugerir melhorias."
        actions={
          <Button render={<Link href="/melhorar-conteudo/nova" />} nativeButton={false}>
            <Plus />
            Nova análise
          </Button>
        }
      />

      {improvements.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhuma análise de conteúdo realizada ainda.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {improvements.map((improvement) => (
                <TableRow key={improvement.id}>
                  <TableCell className="font-medium">
                    <Link href={`/melhorar-conteudo/${improvement.id}`} className="hover:underline">
                      {improvement.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {improvement.client?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {sourceTypeLabels[improvement.sourceType] ?? improvement.sourceType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {improvement.createdAt.toLocaleDateString("pt-BR")}
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
