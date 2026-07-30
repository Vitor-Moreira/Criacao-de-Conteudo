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

export default async function DescobrirCriadoresPage() {
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const discoveries = await prisma.creatorDiscovery.findMany({
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
        title="Buscar Criadores"
        description="Descubra, por tema, os perfis de mídias sociais mais relevantes para estudar e monitorar."
        actions={
          <Button render={<Link href="/descobrir-criadores/nova" />} nativeButton={false}>
            <Plus />
            Nova busca
          </Button>
        }
      />

      {discoveries.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhuma busca de criadores realizada ainda.
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
              {discoveries.map((discovery) => (
                <TableRow key={discovery.id}>
                  <TableCell className="font-medium">
                    <Link href={`/descobrir-criadores/${discovery.id}`} className="hover:underline">
                      {discovery.theme}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {discovery.client?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {discovery.createdAt.toLocaleDateString("pt-BR")}
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
