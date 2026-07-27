import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, clientScopeFilter, clientIdInFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ideaStatusLabels, ideaStatusBadgeClass } from "@/lib/content-idea-labels";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function parseMonthParam(month?: string): { year: number; monthIndex: number } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, m] = month.split("-").map(Number);
    return { year, monthIndex: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

function formatMonthParam(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; clientId?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const { year, monthIndex } = parseMonthParam(params.month);
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const rangeStart = new Date(year, monthIndex, 1);
  const rangeEnd = new Date(year, monthIndex + 1, 1);

  const prevMonth = new Date(year, monthIndex - 1, 1);
  const nextMonth = new Date(year, monthIndex + 1, 1);

  const [ideas, clients] = await Promise.all([
    prisma.contentIdea.findMany({
      where: {
        organizationId: session.user.organizationId,
        scheduledDate: { gte: rangeStart, lt: rangeEnd },
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...clientScopeFilter(accessibleClientIds),
      },
      include: { client: { select: { name: true } } },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.client.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...clientIdInFilter(accessibleClientIds),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const ideasByDay = new Map<number, typeof ideas>();
  for (const idea of ideas) {
    if (!idea.scheduledDate) continue;
    const day = idea.scheduledDate.getDate();
    ideasByDay.set(day, [...(ideasByDay.get(day) ?? []), idea]);
  }

  const firstWeekday = rangeStart.getDay();
  const daysInMonth = rangeEnd.getDate() === 1 ? new Date(year, monthIndex + 1, 0).getDate() : 0;
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const monthLabel = rangeStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const queryString = (m: Date) =>
    `?month=${formatMonthParam(m.getFullYear(), m.getMonth())}${params.clientId ? `&clientId=${params.clientId}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Calendário Editorial"
        description="Visualização em calendário das ideias/roteiros por data agendada."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={queryString(prevMonth)}
            className="flex size-8 items-center justify-center rounded-lg border hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-40 text-center text-sm font-medium capitalize">{monthLabel}</span>
          <Link
            href={queryString(nextMonth)}
            className="flex size-8 items-center justify-center rounded-lg border hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>

        <form className="flex items-end gap-2">
          <input type="hidden" name="month" value={formatMonthParam(year, monthIndex)} />
          <select
            name="clientId"
            defaultValue={params.clientId ?? ""}
            className="h-8 w-40 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos os clientes</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filtrar
          </button>
        </form>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {Array.from({ length: totalCells }).map((_, cellIndex) => {
          const day = cellIndex - firstWeekday + 1;
          const inMonth = day >= 1 && day <= daysInMonth;
          const dayIdeas = inMonth ? (ideasByDay.get(day) ?? []) : [];

          return (
            <div
              key={cellIndex}
              className={`min-h-24 bg-card p-1.5 ${inMonth ? "" : "bg-muted/30 text-muted-foreground"}`}
            >
              {inMonth && <p className="mb-1 text-right text-muted-foreground">{day}</p>}
              <div className="space-y-1">
                {dayIdeas.map((idea) => (
                  <Link
                    key={idea.id}
                    href={`/estudio/${idea.id}`}
                    className="block rounded-md border bg-background p-1 hover:bg-muted"
                  >
                    <p className="truncate font-medium">{idea.title}</p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Badge className={`px-1 py-0 text-[10px] ${ideaStatusBadgeClass[idea.status]}`}>
                        {ideaStatusLabels[idea.status]}
                      </Badge>
                      {idea.client && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {idea.client.name}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
