import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { deleteKnowledgeFile, getKnowledgeFile, bumpKnowledgeFolderStats } from "@zxt/database/client";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STORAGE_ROOT = resolve(process.cwd(), "../../storage/knowledge");

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const file = getKnowledgeFile(tenantId, id);
    if (!file) return fail("KNOWLEDGE_FILE_NOT_FOUND", "文件不存在或已删除。", 404);
    deleteKnowledgeFile(tenantId, id);
    bumpKnowledgeFolderStats(tenantId, file.folderId, -1, -file.size);
    // 清理磁盘文件
    const dir = join(STORAGE_ROOT, tenantId, file.fileId);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
