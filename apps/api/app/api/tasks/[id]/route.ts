import { getTaskDetail } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const { id } = await context.params;
    const isLearner = user?.roleCode === "learner";
    const learnerScope = isLearner && user?.id
      ? { viewerUserId: user.id, viewerOrgId: user.orgId }
      : undefined;
    const detail = getTaskDetail(tenantId, id, learnerScope);
    if (!detail) return fail("TASK_NOT_FOUND", "任务不存在或已删除。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
