import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, postClientScopeFilter, clientIdInFilter, clientScopeFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { networkLabels, formatLabels } from "@/lib/reference-profile-labels";

const RESULTS_LIMIT = 60;

const sortOptions: Record<string, Prisma.ContentPostOrderByWithRelationInput> = {
  recent: { publishedAt: "desc" },
  engagement: { engagementRate: "desc" },
  likes: { likes: "desc" },
};

export default async function BancoDeConteudosPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    network?: string;
    format?: string;
    referenceProfileId?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const sort = sortOptions[params.sort ?? ""] ? params.sort! : "recent";
  const page = Math.max(1, Number(params.page) || 1);
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const where: Prisma.ContentPostWhereInput = {
    organizationId: session.user.organizationId,
    ...(params.network ? { network: params.network as Prisma.ContentPostWhereInput["network"] } : {}),
    ...(params.format ? { format: params.format as Prisma.ContentPostWhereInput["format"] } : {}),
    ...(params.referenceProfileId ? { referenceProfileId: params.referenceProfileId } : {}),
    ...(params.clientId ? { referenceProfile: { clientId: params.clientId } } : {}),
    ...(params.q ? { caption: { contains: params.q, mode: "insensitive" } } : {}),
    ...postClientScopeFilter(accessibleClientIds),
  };

  const [posts, totalCount, clients, referenceProfiles] = await Promise.all([
    prisma.contentPost.findMany({
      where,
      orderBy: sortOptions[sort],
      take: RESULTS_LIMIT,
      skip: (page - 1) * RESULTS_LIMIT,
      include: { referenceProfile: { select: { id: true, handle: true, client: { select: { name: true } } } } },
    }),
    prisma.contentPost.count({ where }),
    prisma.client.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...clientIdInFilter(accessibleClientIds),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.referenceProfile.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...clientScopeFilter(accessibleClientIds),
      },
      orderBy: { handle: "asc" },
      select: { id: true, handle: true },
    }),
  ]);

  const hasFilters = Boolean(
    params.clientId || params.network || params.format || params.referenceProfileId || params.q
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / RESULTS_LIMIT));
  const pageQuery = (targetPage: number) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.clientId) qs.set("clientId", params.clientId);
    if (params.referenceProfileId) qs.set("referenceProfileId", params.referenceProfileId);
    if (params.network) qs.set("network", params.network);
    if (params.format) qs.set("format", params.format);
    if (sort !== "recent") qs.set("sort", sort);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const query = qs.toString();
    return query ? `?${query}` : "";
  };

  return (
    <div>
      <PageHeader
        title="Banco de Conteúdos"
        description="Biblioteca central de tudo que já foi capturado via scraping, com filtros cruzados."
      />

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
            Buscar na legenda
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Palavra-chave..."
            className="h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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

        <div className="flex flex-col gap-1">
          <label htmlFor="referenceProfileId" className="text-xs font-medium text-muted-foreground">
            Perfil de referência
          </label>
          <select
            id="referenceProfileId"
            name="referenceProfileId"
            defaultValue={params.referenceProfileId ?? ""}
            className="h-8 w-40 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos</option>
            {referenceProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                @{profile.handle}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="network" className="text-xs font-medium text-muted-foreground">
            Rede
          </label>
          <select
            id="network"
            name="network"
            defaultValue={params.network ?? ""}
            className="h-8 w-32 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todas</option>
            {Object.entries(networkLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="format" className="text-xs font-medium text-muted-foreground">
            Formato
          </label>
          <select
            id="format"
            name="format"
            defaultValue={params.format ?? ""}
            className="h-8 w-32 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos</option>
            {Object.entries(formatLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sort" className="text-xs font-medium text-muted-foreground">
            Ordenar por
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="h-8 w-40 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="recent">Mais recentes</option>
            <option value="engagement">Maior engajamento</option>
            <option value="likes">Mais curtidas</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filtrar
          </button>
          {hasFilters && (
            <Link
              href="/banco-de-conteudos"
              className="flex h-8 items-center rounded-lg border px-3 text-sm text-muted-foreground hover:bg-muted"
            >
              Limpar
            </Link>
          )}
        </div>
      </form>

      <p className="mb-4 text-sm text-muted-foreground">
        {totalCount === 0
          ? "Nenhum post encontrado."
          : `Mostrando ${(page - 1) * RESULTS_LIMIT + 1}–${(page - 1) * RESULTS_LIMIT + posts.length} de ${totalCount} post${totalCount === 1 ? "" : "s"}.`}
      </p>

      {posts.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhum conteúdo coletado ainda. Cadastre perfis de referência e use &quot;Buscar agora&quot; para
          iniciar a captura.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post) => {
            const thumbnail = Array.isArray(post.mediaUrls) ? (post.mediaUrls[0] as string | undefined) : undefined;
            return (
              <Link key={post.id} href={`/banco-de-conteudos/${post.id}`} className="block">
                <Card className="overflow-hidden py-0 transition-colors hover:border-primary/50">
                  <div className="relative aspect-square w-full bg-muted">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnail}
                        alt={post.caption ?? "Conteúdo"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        Sem mídia
                      </div>
                    )}
                    <Badge variant="outline" className="absolute left-2 top-2 bg-background/90">
                      {formatLabels[post.format]}
                    </Badge>
                  </div>
                  <CardContent className="py-4">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      {post.referenceProfile ? (
                        <span className="truncate text-sm font-medium">@{post.referenceProfile.handle}</span>
                      ) : (
                        <span className="truncate text-sm font-medium">@{post.authorHandle}</span>
                      )}
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {post.publishedAt ? post.publishedAt.toLocaleDateString("pt-BR") : "—"}
                      </span>
                    </div>
                    {post.referenceProfile?.client && (
                      <p className="mb-2 text-xs text-muted-foreground">{post.referenceProfile.client.name}</p>
                    )}
                    <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                      {post.caption ?? "Sem legenda"}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{post.likes} curtidas</span>
                      <span>{post.comments} comentários</span>
                      {post.views != null && <span>{post.views} views</span>}
                      {post.authorFollowers != null && (
                        <span>{(post.engagementRate * 100).toFixed(1)}% eng.</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link
              href={`/banco-de-conteudos${pageQuery(page - 1)}`}
              className="flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
            >
              Anterior
            </Link>
          ) : (
            <span className="flex h-8 items-center rounded-lg border px-3 text-sm text-muted-foreground opacity-50">
              Anterior
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/banco-de-conteudos${pageQuery(page + 1)}`}
              className="flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
            >
              Próxima
            </Link>
          ) : (
            <span className="flex h-8 items-center rounded-lg border px-3 text-sm text-muted-foreground opacity-50">
              Próxima
            </span>
          )}
        </div>
      )}
    </div>
  );
}
