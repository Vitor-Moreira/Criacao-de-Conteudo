export const assetTypeLabels: Record<string, string> = {
  SCRIPT: "Roteiro",
  IMAGE_CONCEPT: "Conceito de imagem",
  COPY: "Copy",
  HOOK_VARIATIONS: "Variações de gancho",
};

export const ideaStatusLabels: Record<string, string> = {
  IDEA: "Ideia",
  SCRIPT_READY: "Roteiro pronto",
  IN_PRODUCTION: "Em produção",
  PUBLISHED: "Publicado",
};

/** Classes de cor por status, para diferenciação visual rápida em badges. */
export const ideaStatusBadgeClass: Record<string, string> = {
  IDEA: "border-border bg-transparent text-muted-foreground",
  SCRIPT_READY: "border-transparent bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  IN_PRODUCTION: "border-transparent bg-primary/15 text-primary",
  PUBLISHED:
    "border-transparent bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
};
