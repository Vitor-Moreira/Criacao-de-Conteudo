import PDFDocument from "pdfkit";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import ExcelJS from "exceljs";
import { parseMarkdownLines, type MarkdownRun } from "@/lib/markdown-runs";

function writePdfRuns(
  doc: PDFKit.PDFDocument,
  runs: MarkdownRun[],
  size: number,
  prefix?: string
) {
  const allRuns = prefix ? [{ text: prefix, bold: false }, ...runs] : runs;
  allRuns.forEach((run, index) => {
    doc.font(run.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    doc.text(run.text, { continued: index < allRuns.length - 1 });
  });
}

export async function generatePdfBuffer(markdown: string, title: string): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica-Bold").fontSize(18).text(title);
  doc.moveDown();

  for (const block of parseMarkdownLines(markdown)) {
    if (block.type === "h1") {
      doc.moveDown(0.5);
      writePdfRuns(doc, block.runs, 16);
      doc.moveDown(0.3);
    } else if (block.type === "h2") {
      doc.moveDown(0.4);
      writePdfRuns(doc, block.runs, 13);
      doc.moveDown(0.2);
    } else if (block.type === "bullet") {
      writePdfRuns(doc, block.runs, 11, "• ");
    } else {
      writePdfRuns(doc, block.runs, 11);
      doc.moveDown(0.2);
    }
  }

  doc.end();
  return done;
}

export async function generateDocxBuffer(markdown: string, title: string): Promise<Buffer> {
  const children: Paragraph[] = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];

  for (const block of parseMarkdownLines(markdown)) {
    const runs = block.runs.map((run) => new TextRun({ text: run.text, bold: run.bold }));

    if (block.type === "h1") {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs }));
    } else if (block.type === "h2") {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs }));
    } else if (block.type === "bullet") {
      children.push(new Paragraph({ bullet: { level: 0 }, children: runs }));
    } else {
      children.push(new Paragraph({ children: runs }));
    }
  }

  const document = new Document({ sections: [{ children }] });
  return Packer.toBuffer(document);
}

export async function generateXlsxBuffer(
  sheets: { name: string; rows: string[][] }[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const validSheets = sheets.length > 0 ? sheets : [{ name: "Planilha", rows: [] }];

  for (const sheet of validSheets) {
    const worksheet = workbook.addWorksheet((sheet.name || "Planilha").slice(0, 31));
    sheet.rows.forEach((row) => worksheet.addRow(row));
    worksheet.columns.forEach((column) => {
      column.width = 24;
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
