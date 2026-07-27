"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/server/actions/team";

const initialState: ActionResult = {};

export function ClientAccessForm({
  action,
  users,
  clients,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  users: { id: string; name: string | null; email: string }[];
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3 sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="userId">Usuário</Label>
        <Select name="userId" required>
          <SelectTrigger id="userId" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name ?? user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="clientId">Cliente</Label>
        <Select name="clientId" required>
          <SelectTrigger id="clientId" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 pb-2">
        <input type="checkbox" id="canEdit" name="canEdit" className="size-4" />
        <Label htmlFor="canEdit" className="font-normal">
          Pode editar
        </Label>
      </div>

      {state.error && (
        <p className="sm:col-span-3 text-sm text-destructive">{state.error}</p>
      )}

      <div className="sm:col-span-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Conceder acesso"}
        </Button>
      </div>
    </form>
  );
}
