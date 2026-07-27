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
import { ideaStatusLabels, ideaStatusBadgeClass } from "@/lib/content-idea-labels";

export default async function EstudioPage() {
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const ideas = await prisma.contentIdea.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...clientScopeFilter(accessibleClientIds),
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      _count: { select: { generatedAssets: true, sourcePosts: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Estúdio de Geração"
        description="Gera roteiros, conceitos de imagem e copies com IA a partir de conteúdos de referência e da base de conhecimento do cliente."
        actions={
          <Button render={<Link href="/estudio/nova" />} nativeButton={false}>
            <Plus />
            Nova ideia
          </Button>
        }
      />

      {ideas.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhuma ideia de conteúdo cadastrada ainda.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posts de referência</TableHead>
                <TableHead>Ativos gerados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ideas.map((idea) => (
                <TableRow key={idea.id}>
                  <TableCell className="font-medium">
                    <Link href={`/estudio/${idea.id}`} className="hover:underline">
                      {idea.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {idea.client?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={ideaStatusBadgeClass[idea.status]}>
                      {ideaStatusLabels[idea.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{idea._count.sourcePosts}</TableCell>
                  <TableCell>{idea._count.generatedAssets}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
