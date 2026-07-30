"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Precisa ser um componente separado (filho do <form>) porque useFormStatus só
// enxerga o estado de pending do form ancestral mais próximo, nunca do form
// que ele mesmo estivesse renderizando.
export function GenerateAssetButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Criando conteúdo, aguarde...
        </>
      ) : (
        label
      )}
    </Button>
  );
}
