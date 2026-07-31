// Parser simples de markdown (subconjunto: #, ##, listas com - / *, **negrito** inline),
// usado tanto pelo gerador de PDF quanto pelo de DOCX em src/lib/document-generation.ts
// para não duplicar a lógica de interpretação do texto gerado pela IA.

export type MarkdownRun = { text: string; bold: boolean };

export type MarkdownBlock = {
  type: "h1" | "h2" | "bullet" | "p";
  runs: MarkdownRun[];
};

function parseInlineBold(line: string): MarkdownRun[] {
  const runs: MarkdownRun[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line))) {
    if (match.index > lastIndex) {
      runs.push({ text: line.slice(lastIndex, match.index), bold: false });
    }
    runs.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    runs.push({ text: line.slice(lastIndex), bold: false });
  }

  return runs.length > 0 ? runs : [{ text: line, bold: false }];
}

export function parseMarkdownLines(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", runs: parseInlineBold(line.slice(3)) });
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h1", runs: parseInlineBold(line.slice(2)) });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ type: "bullet", runs: parseInlineBold(line.slice(2)) });
    } else {
      blocks.push({ type: "p", runs: parseInlineBold(line) });
    }
  }

  return blocks;
}
