import { getAiTrainingSessionForUser, getTrainingRecordBySessionId } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 按对练会话查询训练记录。评分异步完成前返回 data: null，便于前端轮询。
 */
export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const { sessionId } = await params;
    if (!sessionId) return ok(null);

    const isAdmin = user?.roleCode === "tenant_admin";
    const currentUserId = user?.id;
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "请先登录后再访问训练报告。", 401);

    const decodedSessionId = decodeURIComponent(sessionId);
    if (!isAdmin) {
      const session = getAiTrainingSessionForUser(tenantId, decodedSessionId, currentUserId);
      if (!session) return fail("SESSION_NOT_FOUND", "对练会话不存在或不属于当前用户。", 404);
    }

    const detail = getTrainingRecordBySessionId(
      tenantId,
      decodedSessionId,
      isAdmin ? undefined : { userId: currentUserId },
    );
    return ok(detail ?? null);
  } catch (error) {
    return handleRouteError(error);
  }
}
