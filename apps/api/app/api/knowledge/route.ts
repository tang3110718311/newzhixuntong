import { createKnowledgeFolderSchema } from "@zxt/shared";
import { createKnowledgeFolder, listKnowledgeFolders } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const pagination = parsePagination(request);
    return ok(listKnowledgeFolders(tenantId, pagination));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const body = createKnowledgeFolderSchema.parse(await request.json());
    const folder = createKnowledgeFolder(tenantId, { ...body, createdBy: user?.id ?? null });
    if (!folder) return fail("KNOWLEDGE_FOLDER_CREATE_FAILED", "文件夹创建失败。", 400);
    return ok(folder, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}