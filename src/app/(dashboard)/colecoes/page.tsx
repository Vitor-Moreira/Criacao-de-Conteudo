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

export default async function ColecoesPage() {
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const collections = await prisma.collection.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...clientScopeFilter(accessibleClientIds),
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Coleções / Favoritos"
        description="Organize posts e ideias salvos em coleções (ex: 'Ideias Reels Janeiro')."
        actions={
          <Button render={<Link href="/colecoes/nova" />} nativeButton={false}>
            <Plus />
            Nova coleção
          </Button>
        }
      />

      {collections.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhuma coleção cadastrada ainda.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Itens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((collection) => (
                <TableRow key={collection.id}>
                  <TableCell className="font-medium">
                    <Link href={`/colecoes/${collection.id}`} className="hover:underline">
                      {collection.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {collection.client?.name ?? "—"}
                  </TableCell>
                  <TableCell>{collection._count.items}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
