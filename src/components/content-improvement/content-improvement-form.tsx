"use client";

import { useActionState, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/server/actions/content-improvement";

const initialState: ActionResult = {};

export function ContentImprovementForm({
  action,
  clients,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [sourceMode, setSourceMode] = useState<"text" | "file">("text");
  const [clientSelection, setClientSelection] = useState("none");

  const clientMode =
    clientSelection === "none" ? "none" : clientSelection === "new" ? "new" : "existing";
  const clientId = clientMode === "existing" ? clientSelection : "";

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" placeholder="Ex: Roteiro de reels — semana 32" required />
      </div>

      <div className="space-y-2">
        <Label>Conteúdo a melhorar</Label>
        <Tabs
          value={sourceMode}
          onValueChange={(value) => setSourceMode(value as "text" | "file")}
        >
          <TabsList>
            <TabsTrigger value="text">Colar texto</TabsTrigger>
            <TabsTrigger value="file">Enviar arquivo</TabsTrigger>
          </TabsList>
        </Tabs>
        <input type="hidden" name="sourceMode" value={sourceMode} />

        {sourceMode === "text" ? (
          <Textarea
            name="text"
            placeholder="Cole aqui o roteiro, copy, legenda ou planejamento já escrito..."
            className="min-h-40"
          />
        ) : (
          <div className="space-y-1">
            <Input type="file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx" />
            <p className="text-xs text-muted-foreground">
              PDF, DOCX ou XLSX, até 4MB. O conteúdo melhorado será gerado no mesmo formato.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="clientSelection">Cliente</Label>
        <Select
          value={clientSelection}
          onValueChange={(value) => setClientSelection(value ?? "none")}
        >
          <SelectTrigger id="clientSelection" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
            <SelectItem value="new">Criar novo cliente a partir deste conteúdo...</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="clientMode" value={clientMode} />
        <input type="hidden" name="clientId" value={clientId} />
        {clientMode === "existing" && (
          <p className="text-xs text-muted-foreground">
            As sugestões vão respeitar o tom de voz, público e pilares já cadastrados neste
            cliente.
          </p>
        )}
      </div>

      {clientMode === "new" && (
        <div className="space-y-2">
          <Label htmlFor="newClientName">Nome do novo cliente</Label>
          <Input id="newClientName" name="newClientName" placeholder="Nome do cliente" required />
          <p className="text-xs text-muted-foreground">
            O perfil do cliente (resumo do negócio, público e tom de voz) será pré-preenchido
            pela IA a partir do conteúdo enviado.
          </p>
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Analisando conteúdo, aguarde...
          </>
        ) : (
          "Analisar e melhorar"
        )}
      </Button>
    </form>
  );
}
