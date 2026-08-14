import { getTrainingRecordBySessionId } from "@zxt/database";
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

    const currentUserId = user?.id;
    if (!currentUserId) return fail("AUTH_REQUIRED", "请先登录后再访问训练报告。", 401);

    const detail = getTrainingRecordBySessionId(
      tenantId,
      decodeURIComponent(sessionId),
      { userId: currentUserId },
    );
    return ok(detail ?? null);
  } catch (error) {
    return handleRouteError(error);
  }
}
