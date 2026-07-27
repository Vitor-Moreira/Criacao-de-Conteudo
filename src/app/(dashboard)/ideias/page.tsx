import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, clientIdInFilter, postClientScopeFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatLabels } from "@/lib/reference-profile-labels";

const RESULTS_LIMIT = 30;

type PostWithProfile = Prisma.ContentPostGetPayload<{
  include: { referenceProfile: { select: { id: true; handle: true; client: { select: { name: true } } } } };
}>;

export default async function IdeiasPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; clientId?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const theme = params.theme?.trim();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const clients = await prisma.client.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...clientIdInFilter(accessibleClientIds),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  let posts: PostWithProfile[] = [];
  if (theme) {
    const where: Prisma.ContentPostWhereInput = {
      organizationId: session.user.organizationId,
      caption: { contains: theme, mode: "insensitive" },
      ...(params.clientId ? { referenceProfile: { clientId: params.clientId } } : {}),
      ...postClientScopeFilter(accessibleClientIds),
    };

    posts = await prisma.contentPost.findMany({
      where,
      orderBy: { engagementRate: "desc" },
      take: RESULTS_LIMIT,
      include: {
        referenceProfile: { select: { id: true, handle: true, client: { select: { name: true } } } },
      },
    });
  }

  return (
    <div>
      <PageHeader
        title="Buscar Ideias por Tema"
        description="Cruza o banco de conteúdos com um tema/nicho e ranqueia por engajamento normalizado."
      />

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="theme" className="text-xs font-medium text-muted-foreground">
            Tema / nicho
          </label>
          <input
            id="theme"
            name="theme"
            defaultValue={params.theme ?? ""}
            placeholder="Ex: rotina matinal, receitas fit..."
            className="h-8 w-64 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="clientId" className="text-xs font-medium text-muted-foreground">
            Cliente
          </label>
          <select
            id="clientId"
            name="clientId"
            defaultValue={params.clientId ?? ""}
            className="h-8 w-40 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Buscar
        </button>
      </form>

      {!theme ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Informe um tema para cruzar com o banco de conteúdos coletado.
        </div>
      ) : posts.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhum post encontrado para &quot;{theme}&quot;.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {posts.length} post{posts.length === 1 ? "" : "s"} encontrado
            {posts.length === 1 ? "" : "s"}, ranqueados por engajamento.
          </p>
          {posts.map((post, index) => (
            <Card key={post.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 text-sm font-semibold text-muted-foreground">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatLabels[post.format]}</Badge>
                      {post.referenceProfile && (
                        <Link
                          href={`/perfis/${post.referenceProfile.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          @{post.referenceProfile.handle}
                        </Link>
                      )}
                      {post.referenceProfile?.client && (
                        <span className="text-xs text-muted-foreground">
                          {post.referenceProfile.client.name}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {post.caption ?? "Sem legenda"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{post.likes} curtidas</span>
                      <span>{post.comments} comentários</span>
                      {post.authorFollowers != null && (
                        <span>{(post.engagementRate * 100).toFixed(1)}% eng.</span>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/estudio/nova?theme=${encodeURIComponent(theme)}${
                    params.clientId ? `&clientId=${params.clientId}` : ""
                  }`}
                  className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Criar ideia
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
