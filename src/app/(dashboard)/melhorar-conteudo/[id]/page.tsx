import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getAccessibleClientIds, canAccessClient } from "@/lib/client-access";
import { PageHeader } from "@/components/layout/page-header";
import { deleteContentImprovementAction } from "@/server/actions/content-improvement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Download, ExternalLink } from "lucide-react";

const sourceTypeLabels: Record<string, string> = {
  TEXT: "Texto",
  PDF: "PDF",
  DOCX: "DOCX",
  XLSX: "XLSX",
};

const proseClassName =
  "prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 first:prose-headings:mt-0";

export default async function ContentImprovementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const accessibleClientIds = await getAccessibleClientIds(session.user.id, session.user.role);

  const improvement = await prisma.contentImprovement.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: { client: { select: { id: true, name: true } } },
  });

  if (!improvement) notFound();
  if (!canAccessClient(improvement.clientId, accessibleClientIds)) notFound();

  const boundDelete = deleteContentImprovementAction.bind(null, improvement.id);

  return (
    <div>
      <PageHeader
        title={improvement.title}
        description={improvement.client?.name ?? "Nenhum cliente associado"}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {sourceTypeLabels[improvement.sourceType] ?? improvement.sourceType}
            </Badge>
            <form action={boundDelete}>
              <Button type="submit" variant="ghost" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </form>
          </div>
        }
      />

      {improvement.errorMessage && !improvement.analysis ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-destructive">
          Erro ao analisar o conteúdo: {improvement.errorMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {improvement.analysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Análise</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={proseClassName}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {improvement.analysis}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}

            {improvement.improvedText && (
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">Conteúdo melhorado</CardTitle>
                  {improvement.resultFileUrl && (
                    <a
                      href={improvement.resultFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <Download className="size-4" />
                      Baixar {sourceTypeLabels[improvement.sourceType]}
                    </a>
                  )}
                </CardHeader>
                <CardContent>
                  <div className={proseClassName}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {improvement.improvedText}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conteúdo original</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {improvement.originalFileUrl && (
                  <a
                    href={improvement.originalFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="size-4" />
                    Ver arquivo enviado
                  </a>
                )}
                <p className="line-clamp-[12] whitespace-pre-wrap text-xs text-muted-foreground">
                  {improvement.originalText || "Sem conteúdo original."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
