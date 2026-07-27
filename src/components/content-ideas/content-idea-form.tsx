"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/server/actions/content-ideas";

const initialState: ActionResult = {};

export type ContentIdeaFormDefaults = {
  title?: string;
  description?: string | null;
  theme?: string | null;
  clientId?: string | null;
};

export function ContentIdeaForm({
  action,
  defaultValues,
  clients,
  submitLabel,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaultValues?: ContentIdeaFormDefaults;
  clients: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Título da ideia</Label>
          <Input id="title" name="title" defaultValue={defaultValues?.title} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Tema</Label>
          <Input
            id="theme"
            name="theme"
            placeholder="Ex: bastidores, dicas rápidas"
            defaultValue={defaultValues?.theme ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientId">Cliente associado (opcional)</Label>
          <Select name="clientId" defaultValue={defaultValues?.clientId ?? "none"}>
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

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Descrição / briefing</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={defaultValues?.description ?? ""}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
