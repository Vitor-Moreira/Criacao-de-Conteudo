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
import { networkLabels, frequencyLabels } from "@/lib/reference-profile-labels";

export default async function PerfisPage() {
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const profiles = await prisma.referenceProfile.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...clientScopeFilter(accessibleClientIds),
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      _count: { select: { contentPosts: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Perfis de Referência"
        description="Cadastro e monitoramento de perfis via Apify, com atualização manual e periódica."
        actions={
          <Button render={<Link href="/perfis/novo" />} nativeButton={false}>
            <Plus />
            Novo perfil
          </Button>
        }
      />

      {profiles.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhum perfil de referência cadastrado ainda.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Handle</TableHead>
                <TableHead>Rede</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Posts coletados</TableHead>
                <TableHead>Último scrape</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">
                    <Link href={`/perfis/${profile.id}`} className="hover:underline">
                      @{profile.handle}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{networkLabels[profile.network]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {profile.client?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {frequencyLabels[profile.scrapeFrequency]}
                  </TableCell>
                  <TableCell>{profile._count.contentPosts}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {profile.lastScrapedAt
                      ? profile.lastScrapedAt.toLocaleDateString("pt-BR")
                      : "Nunca"}
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
