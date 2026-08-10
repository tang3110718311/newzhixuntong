import { getTrainingRecordBySessionId } from "@zxt/database/client";
import { handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 按对练会话查询训练记录（含评分明细）。
 * 对练结束评分在后台异步执行，前端轮询本接口直到返回记录。
 * 未找到时返回 data: null（区别于 404，便于前端继续轮询）。
 */
export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { sessionId } = await params;
    if (!sessionId) {
      return ok(null);
    }
    const detail = getTrainingRecordBySessionId(tenantId, decodeURIComponent(sessionId));
    return ok(detail ?? null);
  } catch (error) {
    return handleRouteError(error);
  }
}
