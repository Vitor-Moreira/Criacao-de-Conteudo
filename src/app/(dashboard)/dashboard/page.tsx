import { Users, ScanSearch, Lightbulb } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAccessibleClientIds, clientIdInFilter, clientScopeFilter } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  const organizationId = session!.user.organizationId;
  const accessibleClientIds = await getAccessibleClientIds(session!.user.id, session!.user.role);

  const [clientCount, referenceProfileCount, ideaCount] = await Promise.all([
    prisma.client.count({ where: { organizationId, ...clientIdInFilter(accessibleClientIds) } }),
    prisma.referenceProfile.count({
      where: { organizationId, ...clientScopeFilter(accessibleClientIds) },
    }),
    prisma.contentIdea.count({
      where: { organizationId, ...clientScopeFilter(accessibleClientIds) },
    }),
  ]);

  const stats = [
    { label: "Clientes ativos", value: clientCount, icon: Users },
    { label: "Perfis monitorados", value: referenceProfileCount, icon: ScanSearch },
    { label: "Ideias geradas", value: ideaCount, icon: Lightbulb },
  ];

  return (
    <div>
      <PageHeader
        title={`Olá, ${session?.user?.name?.split(" ")[0] ?? ""}`}
        description="Visão geral da sua operação de conteúdo."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
