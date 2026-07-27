"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

export function CollectionNameEditor({
  collectionId,
  name,
  action,
}: {
  collectionId: string;
  name: string;
  action: (collectionId: string, formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        await action(collectionId, formData);
        setEditing(false);
      }}
      className="flex items-center gap-1.5"
    >
      <Input name="name" defaultValue={name} autoFocus className="h-9 w-64" />
      <Button type="submit" variant="ghost" size="icon" className="size-7">
        <Check className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setEditing(false)}
      >
        <X className="size-3.5" />
      </Button>
    </form>
  );
}
