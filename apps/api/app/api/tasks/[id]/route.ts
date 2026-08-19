import { deleteStoppedTask, getTaskDetail } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireTrainingManager } from "@/lib/authz";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const { id } = await context.params;
    // 与列表接口保持一致：仅企业管理员（tenant_admin）可见全部任务详情，其余角色仅可见本人参与的任务
    const isAdmin = user?.roleCode === "tenant_admin";
    const learnerScope = !isAdmin && user?.id
      ? { viewerUserId: user.id, viewerOrgId: user.orgId }
      : undefined;
    const detail = getTaskDetail(tenantId, id, learnerScope);
    if (!detail) return fail("TASK_NOT_FOUND", "任务不存在或已删除。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const { id } = await context.params;
    const deleted = deleteStoppedTask(tenantId, id);
    if (!deleted) return fail("TASK_NOT_STOPPED", "仅已停用任务可以删除。", 409);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
