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
import type { ActionResult } from "@/server/actions/clients";

const initialState: ActionResult = {};

export type ClientFormDefaults = {
  name?: string;
  segment?: string | null;
  businessSummary?: string | null;
  targetAudience?: string | null;
  toneOfVoice?: string | null;
  contentPillars?: string[];
  restrictions?: string[];
  status?: "ACTIVE" | "INACTIVE";
};

export function ClientForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaultValues?: ClientFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nome do cliente</Label>
          <Input id="name" name="name" defaultValue={defaultValues?.name} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="segment">Segmento / nicho</Label>
          <Input id="segment" name="segment" defaultValue={defaultValues?.segment ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={defaultValues?.status ?? "ACTIVE"}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Ativo</SelectItem>
              <SelectItem value="INACTIVE">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="businessSummary">Resumo do negócio</Label>
          <Textarea
            id="businessSummary"
            name="businessSummary"
            rows={3}
            defaultValue={defaultValues?.businessSummary ?? ""}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="targetAudience">Público-alvo</Label>
          <Textarea
            id="targetAudience"
            name="targetAudience"
            rows={2}
            defaultValue={defaultValues?.targetAudience ?? ""}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="toneOfVoice">Tom de voz da marca</Label>
          <Textarea
            id="toneOfVoice"
            name="toneOfVoice"
            rows={2}
            defaultValue={defaultValues?.toneOfVoice ?? ""}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contentPillars">Pilares de conteúdo</Label>
          <Textarea
            id="contentPillars"
            name="contentPillars"
            rows={2}
            placeholder="Um por linha ou separado por vírgula"
            defaultValue={defaultValues?.contentPillars?.join("\n") ?? ""}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="restrictions">Restrições (o que evitar)</Label>
          <Textarea
            id="restrictions"
            name="restrictions"
            rows={2}
            placeholder="Ex: nunca falar de X, sempre citar Y — um por linha"
            defaultValue={defaultValues?.restrictions?.join("\n") ?? ""}
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
