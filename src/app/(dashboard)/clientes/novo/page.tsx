import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { createClientAction } from "@/server/actions/clients";
import { Card, CardContent } from "@/components/ui/card";

export default function NovoClientePage() {
  return (
    <div>
      <PageHeader
        title="Novo cliente"
        description="Cadastre o cliente e a base de conhecimento que vai alimentar a geração de IA."
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ClientForm action={createClientAction} submitLabel="Criar cliente" />
        </CardContent>
      </Card>
    </div>
  );
}
