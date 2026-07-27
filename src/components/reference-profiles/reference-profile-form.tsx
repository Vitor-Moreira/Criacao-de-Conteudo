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
import type { ActionResult } from "@/server/actions/reference-profiles";
import { networkLabels, frequencyLabels } from "@/lib/reference-profile-labels";

const initialState: ActionResult = {};

export type ReferenceProfileFormDefaults = {
  network?: "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "LINKEDIN";
  handle?: string;
  url?: string;
  category?: string | null;
  scrapeFrequency?: "MANUAL" | "DAILY" | "WEEKLY";
  clientId?: string | null;
};

export function ReferenceProfileForm({
  action,
  defaultValues,
  clients,
  submitLabel,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaultValues?: ReferenceProfileFormDefaults;
  clients: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="network">Rede social</Label>
          <Select name="network" defaultValue={defaultValues?.network ?? "INSTAGRAM"}>
            <SelectTrigger id="network" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(networkLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="handle">Handle / @usuário</Label>
          <Input
            id="handle"
            name="handle"
            placeholder="usuario"
            defaultValue={defaultValues?.handle}
            required
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="url">URL do perfil</Label>
          <Input
            id="url"
            name="url"
            type="url"
            placeholder="https://www.instagram.com/usuario/"
            defaultValue={defaultValues?.url}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Input
            id="category"
            name="category"
            placeholder="Ex: concorrente, benchmark"
            defaultValue={defaultValues?.category ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="scrapeFrequency">Frequência de coleta</Label>
          <Select
            name="scrapeFrequency"
            defaultValue={defaultValues?.scrapeFrequency ?? "MANUAL"}
          >
            <SelectTrigger id="scrapeFrequency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(frequencyLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="clientId">Cliente associado (opcional)</Label>
          <Select name="clientId" defaultValue={defaultValues?.clientId ?? "none"}>
            <SelectTrigger id="clientId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum — monitoramento geral</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
