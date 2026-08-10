import { getTaskDetail } from "@zxt/database/client";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const detail = getTaskDetail(tenantId, id);
    if (!detail) return fail("TASK_NOT_FOUND", "任务不存在或已删除。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
