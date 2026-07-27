import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { OrganizationForm } from "@/components/settings/organization-form";
import { TeamMemberForm } from "@/components/settings/team-member-form";
import { ClientAccessForm } from "@/components/settings/client-access-form";
import { RoleSelect } from "@/components/settings/role-select";
import { updateOrganizationAction } from "@/server/actions/organization";
import {
  createTeamMemberAction,
  updateMemberRoleAction,
  deleteMemberAction,
  createClientAccessAction,
  deleteClientAccessAction,
} from "@/server/actions/team";
import { roleLabels } from "@/lib/roles";
import { usageTypeLabels } from "@/lib/usage-labels";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ConfiguracoesPage() {
  const session = await requireSession();
  const isOwner = session.user.role === "OWNER";

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [organization, users, clients, clientAccessList, usageByType] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: session.user.organizationId } }),
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.client.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.clientAccess.findMany({
      where: { user: { organizationId: session.user.organizationId } },
      include: { user: true, client: true },
      orderBy: { id: "asc" },
    }),
    prisma.usageLog.groupBy({
      by: ["type"],
      where: {
        organizationId: session.user.organizationId,
        createdAt: { gte: monthStart },
      },
      _sum: { costCents: true },
    }),
  ]);

  const totalCents = usageByType.reduce((sum, item) => sum + (item._sum.costCents ?? 0), 0);
  const budgetCents = organization.monthlyBudgetCents;
  const usagePercent = budgetCents ? Math.min(100, Math.round((totalCents / budgetCents) * 100)) : null;

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Dados da organização, membros da equipe, permissões por cliente e limites de uso."
      />

      <Tabs defaultValue="organizacao" className="max-w-3xl">
        <TabsList>
          <TabsTrigger value="organizacao">Organização</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="uso">Uso e limites</TabsTrigger>
        </TabsList>

        <TabsContent value="organizacao">
          <Card>
            <CardContent className="pt-6">
              {isOwner ? (
                <OrganizationForm
                  action={updateOrganizationAction}
                  defaultValues={{
                    name: organization.name,
                    monthlyBudgetCents: organization.monthlyBudgetCents,
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Apenas o proprietário pode alterar os dados da organização.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipe" className="space-y-4">
          {isOwner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Adicionar membro</CardTitle>
              </CardHeader>
              <CardContent>
                <TeamMemberForm action={createTeamMemberAction} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    {isOwner && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = user.id === session.user.id;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>{user.name ?? "—"}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {isOwner && !isSelf ? (
                            <RoleSelect
                              memberId={user.id}
                              defaultValue={user.role}
                              action={updateMemberRoleAction}
                            />
                          ) : (
                            <Badge variant="outline">{roleLabels[user.role]}</Badge>
                          )}
                        </TableCell>
                        {isOwner && (
                          <TableCell className="text-right">
                            {!isSelf && (
                              <form action={deleteMemberAction.bind(null, user.id)}>
                                <Button variant="ghost" size="icon" type="submit">
                                  <Trash2 className="size-4" />
                                </Button>
                              </form>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissoes" className="space-y-4">
          {isOwner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conceder acesso a um cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientAccessForm
                  action={createClientAccessAction}
                  users={users}
                  clients={clients}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              {clientAccessList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma permissão granular configurada ainda. Por padrão, membros da equipe
                  enxergam todos os clientes da organização.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pode editar</TableHead>
                      {isOwner && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientAccessList.map((access) => (
                      <TableRow key={access.id}>
                        <TableCell>{access.user.name ?? access.user.email}</TableCell>
                        <TableCell>{access.client.name}</TableCell>
                        <TableCell>
                          <Badge variant={access.canEdit ? "default" : "outline"}>
                            {access.canEdit ? "Sim" : "Não"}
                          </Badge>
                        </TableCell>
                        {isOwner && (
                          <TableCell className="text-right">
                            <form action={deleteClientAccessAction.bind(null, access.id)}>
                              <Button variant="ghost" size="icon" type="submit">
                                <Trash2 className="size-4" />
                              </Button>
                            </form>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uso" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumo do mês atual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {formatCents(totalCents)}
                  {budgetCents != null && (
                    <span className="ml-2 text-base font-normal text-muted-foreground">
                      de {formatCents(budgetCents)} ({usagePercent}%)
                    </span>
                  )}
                </p>
                {budgetCents == null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Defina um orçamento mensal na aba &quot;Organização&quot; para acompanhar o
                    percentual consumido.
                  </p>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de uso</TableHead>
                    <TableHead className="text-right">Custo no mês</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageByType.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        Nenhum uso registrado neste mês ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    usageByType.map((item) => (
                      <TableRow key={item.type}>
                        <TableCell>{usageTypeLabels[item.type] ?? item.type}</TableCell>
                        <TableCell className="text-right">
                          {formatCents(item._sum.costCents ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
