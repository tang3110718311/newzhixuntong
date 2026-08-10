import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  bumpKnowledgeFolderStats,
  createId,
  createKnowledgeFile,
  getDefaultAiProvider,
  getKnowledgeFile,
  listKnowledgeFiles,
} from "@zxt/database/client";
import { createOpenAiCompatibleLlmProvider } from "@zxt/ai-provider";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { isSupportedDocumentMime, mimeFromExtension, parseDocumentFile } from "@/lib/document-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const STORAGE_ROOT = resolve(process.cwd(), "../../storage/knowledge");

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const url = new URL(request.url);
    const folderId = url.searchParams.get("folderId") || "";
    if (!folderId) return fail("FOLDER_ID_REQUIRED", "缺少 folderId 参数。", 400);
    return ok(listKnowledgeFiles(tenantId, folderId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const formData = await request.formData();
    const file = formData.get("file");
    const folderId = String(formData.get("folderId") || "");

    if (!(file instanceof File)) return fail("FILE_REQUIRED", "缺少上传文件。", 400);
    if (!folderId) return fail("FOLDER_ID_REQUIRED", "缺少文件夹。", 400);
    if (file.size > MAX_FILE_SIZE) return fail("FILE_TOO_LARGE", "文件超过 50MB 限制。", 413);

    const mimeType = file.type || mimeFromExtension(file.name);
    if (!isSupportedDocumentMime(mimeType)) {
      return fail("UNSUPPORTED_FILE_TYPE", "仅支持 PDF / Word / Excel / PPT / TXT 文档。", 415);
    }

    // 物理落盘
    const fileId = createId("file");
    const dir = join(STORAGE_ROOT, tenantId, fileId);
    mkdirSync(dir, { recursive: true });
    const storagePath = join(dir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(storagePath, buffer);

    // 解析 + AI 摘要
    let content = "";
    let summary = "";
    let parseStatus = "done";
    let parseError = "";
    try {
      const parsed = await parseDocumentFile(storagePath, mimeType);
      content = parsed.text;
    } catch (err) {
      parseStatus = "failed";
      parseError = err instanceof Error ? err.message : "解析失败";
    }

    if (parseStatus === "done" && content.trim()) {
      try {
        const config = getDefaultAiProvider(tenantId);
        if (config && config.status === "enabled" && config.apiKeyEncrypted && config.baseUrl) {
          const provider = createOpenAiCompatibleLlmProvider({
            baseUrl: config.baseUrl,
            apiKey: config.apiKeyEncrypted,
            modelName: config.modelName,
            providerName: config.providerName,
          });
          const result = await provider.summarizeKnowledge({ tenantId, fileName: file.name, content });
          summary = result.summary;
        }
      } catch (err) {
        summary = "";
      }
    }

    // 落库
    const created = createKnowledgeFile(tenantId, {
      folderId,
      fileId,
      name: file.name,
      mimeType,
      size: file.size,
      content,
      summary,
      parseStatus,
      parseError,
      createdBy: user?.id ?? null,
    });
    if (!created) {
      rmSync(dir, { recursive: true, force: true });
      return fail("KNOWLEDGE_FILE_CREATE_FAILED", "文件入库失败。", 500);
    }
    bumpKnowledgeFolderStats(tenantId, folderId, 1, file.size);

    return ok(created, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
