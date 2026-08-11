import { getSceneDetail } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const detail = getSceneDetail(tenantId, id);
    if (!detail) return fail("SCENE_NOT_FOUND", "场景不存在或已删除。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}