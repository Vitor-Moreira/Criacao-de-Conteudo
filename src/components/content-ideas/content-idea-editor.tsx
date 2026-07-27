"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";

export function ContentIdeaEditor({
  ideaId,
  title,
  theme,
  description,
  action,
}: {
  ideaId: string;
  title: string;
  theme: string | null;
  description: string | null;
  action: (ideaId: string, formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" />
        Editar briefing
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await action(ideaId, formData);
        setEditing(false);
      }}
      className="space-y-3 rounded-lg border p-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="idea-title">Título</Label>
        <Input id="idea-title" name="title" defaultValue={title} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="idea-theme">Tema</Label>
        <Input id="idea-theme" name="theme" defaultValue={theme ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="idea-description">Descrição</Label>
        <Textarea id="idea-description" name="description" rows={3} defaultValue={description ?? ""} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Salvar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
