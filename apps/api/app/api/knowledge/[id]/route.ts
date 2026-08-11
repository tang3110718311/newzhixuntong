import { updateKnowledgeFolderSchema } from "@zxt/shared";
import { deleteKnowledgeFolder, updateKnowledgeFolder } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const body = updateKnowledgeFolderSchema.parse(await request.json());
    const folder = updateKnowledgeFolder(tenantId, id, body);
    if (!folder) return fail("KNOWLEDGE_FOLDER_NOT_FOUND", "文件夹不存在或已删除。", 404);
    return ok(folder);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const folder = updateKnowledgeFolder(tenantId, id, {});
    if (!folder) return fail("KNOWLEDGE_FOLDER_NOT_FOUND", "文件夹不存在或已删除。", 404);
    deleteKnowledgeFolder(tenantId, id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}