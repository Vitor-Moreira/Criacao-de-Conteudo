"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/server/actions/collections";

const initialState: ActionResult = {};

export function CollectionForm({
  action,
  clients,
  submitLabel,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  clients: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nome da coleção</Label>
        <Input id="name" name="name" placeholder="Ex: Ideias Reels Janeiro" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="clientId">Cliente associado (opcional)</Label>
        <Select name="clientId" defaultValue="none">
          <SelectTrigger id="clientId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
