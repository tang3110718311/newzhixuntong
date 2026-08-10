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

// XML 实体反转义：覆盖常用命名实体与数字实体（十六进制 / 十进制）
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isNaN(code) || code > 0x10ffff ? m : String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (m, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isNaN(code) || code > 0x10ffff ? m : String.fromCodePoint(code);
    });
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
    assertSafeZip(zip); // 解压炸弹防护
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
      const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1]));
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

// 魔数校验：防止伪装类型上传（如把可执行/恶意文件改名为 .pdf/.docx）
export function detectRealMime(buffer: Buffer, declaredMime: string): string {
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf"; // %PDF
  }
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    // PK -> OOXML 家族（docx/xlsx/pptx 均为 zip 容器），仅接受声明为 OOXML 的类型
    if (declaredMime.includes("wordprocessingml") || declaredMime.includes("spreadsheetml") || declaredMime.includes("presentationml")) {
      return declaredMime;
    }
    return "application/zip"; // zip 容器但不是受支持的文档类型
  }
  if (declaredMime === "text/plain" || declaredMime === "text/markdown") {
    return declaredMime; // 纯文本不做魔数强校验
  }
  return declaredMime; // 其余交由 isSupportedDocumentMime 白名单拦截
}

// 解压炸弹防护：PPTX（zip 容器）解压条目数/体积上限
const MAX_ZIP_ENTRIES = 3000;
const MAX_ZIP_TOTAL = 300 * 1024 * 1024; // 300MB 解压总量
const MAX_ZIP_SINGLE = 30 * 1024 * 1024; // 单文件 30MB

function assertSafeZip(zip: JSZip): void {
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(`压缩包条目过多（${entries.length} > ${MAX_ZIP_ENTRIES}）`);
  }
  let total = 0;
  for (const f of entries) {
    if (f.dir) continue;
    const size = (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (size > MAX_ZIP_SINGLE) throw new Error("压缩包内单个文件过大");
    total += size;
    if (total > MAX_ZIP_TOTAL) throw new Error("压缩包解压总量过大");
  }
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
