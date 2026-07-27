"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/server/actions/organization";

const initialState: ActionResult = {};

export function OrganizationForm({
  action,
  defaultValues,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaultValues: { name: string; monthlyBudgetCents: number | null };
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nome da organização</Label>
        <Input id="name" name="name" defaultValue={defaultValues.name} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="monthlyBudgetCents">Orçamento mensal (R$)</Label>
        <Input
          id="monthlyBudgetCents"
          name="monthlyBudgetCents"
          type="text"
          inputMode="decimal"
          placeholder="Ex: 500,00"
          defaultValue={
            defaultValues.monthlyBudgetCents != null
              ? (defaultValues.monthlyBudgetCents / 100).toFixed(2).replace(".", ",")
              : ""
          }
        />
        <p className="text-xs text-muted-foreground">
          Usado para acompanhar o consumo de Apify e Claude na aba &quot;Uso e limites&quot;.
        </p>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
