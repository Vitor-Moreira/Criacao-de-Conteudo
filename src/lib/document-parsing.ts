import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import type { ContentImprovementSourceType } from "@/generated/prisma/client";

// Limite abaixo do teto de payload de Server Actions/funções serverless da Vercel (4.5MB),
// deixando margem para o overhead do multipart/form-data.
export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 40_000;

export class UnsupportedFileTypeError extends Error {}
export class FileTooLargeError extends Error {}

export function detectSourceType(file: File): ContentImprovementSourceType {
  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return "PDF";
  }
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "DOCX";
  }
  if (
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    name.endsWith(".xlsx")
  ) {
    return "XLSX";
  }

  throw new UnsupportedFileTypeError(
    "Formato de arquivo não suportado. Envie um PDF, DOCX ou XLSX."
  );
}

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACTED_CHARS) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, MAX_EXTRACTED_CHARS), truncated: true };
}

export async function extractTextFromFile(file: File): Promise<{
  sourceType: ContentImprovementSourceType;
  text: string;
  truncated: boolean;
}> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError("Arquivo maior que 4MB. Envie um arquivo menor.");
  }

  const sourceType = detectSourceType(file);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (sourceType === "PDF") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return { sourceType, ...truncate(result.text) };
    } finally {
      await parser.destroy();
    }
  }

  if (sourceType === "DOCX") {
    const result = await mammoth.extractRawText({ buffer });
    return { sourceType, ...truncate(result.value) };
  }

  // XLSX
  const workbook = new ExcelJS.Workbook();
  // exceljs redeclara `Buffer` globalmente de forma incompatível com @types/node
  // (ver node_modules/exceljs/index.d.ts:1); `any` evita o conflito de tipos.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const parts: string[] = [];
  workbook.worksheets.forEach((sheet) => {
    parts.push(`# Aba: ${sheet.name}`);
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1);
      parts.push(cells.map((cell) => (cell ?? "").toString()).join(" | "));
    });
  });
  return { sourceType, ...truncate(parts.join("\n")) };
}
