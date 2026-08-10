import { readFileSync } from "node:fs";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";

export type ParsedDocument = { text: string; truncated: boolean };

const MAX_CHARS = 20000;

function truncate(text: string): ParsedDocument {
  const truncated = text.length > MAX_CHARS;
  return { text: truncated ? text.slice(0, MAX_CHARS) : text, truncated };
}

export async function parseDocumentFile(filePath: string, mimeType: string): Promise<ParsedDocument> {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return truncate(readFileSync(filePath, "utf-8"));
  }
  if (mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = readFileSync(filePath);
    const data = await pdfParse(buffer);
    return truncate(data.text || "");
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const buffer = readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return truncate(result.value || "");
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const buffer = readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      parts.push(`[${sheetName}]\n${csv}`);
    }
    return truncate(parts.join("\n\n"));
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    const buffer = readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        return na - nb;
      });
    const parts: string[] = [];
    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile].async("text");
      const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
      parts.push(`[slide ${slideFile.match(/slide(\d+)/)?.[1] ?? "?"}]\n${texts.join("\n")}`);
    }
    return truncate(parts.join("\n\n"));
  }
  throw new Error(`不支持的文档格式：${mimeType}`);
}

export function isSupportedDocumentMime(mimeType: string): boolean {
  return [
    "text/plain",
    "text/markdown",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ].includes(mimeType);
}

export function mimeFromExtension(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] || "application/octet-stream";
}
