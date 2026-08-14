import { getAiTrainingSessionForUser, getDefaultAiProvider, getSceneDetail, getTrainingRecordBySessionId } from "@zxt/database";
import { createTraceId, fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { parseSessionHistory, scoreAndSaveRecordSafe } from "@/lib/ai-scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 恢复兜底节流：同一会话恢复评分最小间隔 30s，避免前端 2s 轮询期间重复触发 LLM 评分
const recoverThrottle = new Map<string, number>();
const RECOVER_MIN_INTERVAL_MS = 30_000;

/**
 * 按对练会话查询训练记录。评分异步完成前返回 data: null，便于前端轮询。
 * 兜底：会话已 completed 但训练记录缺失（偶发：评分任务在路由重建/热更新时丢失），
 * 用落盘历史重新触发评分落库，前端轮询可自愈拿到记录。
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
    let session: ReturnType<typeof getAiTrainingSessionForUser> | null = null;
    if (!isAdmin) {
      session = getAiTrainingSessionForUser(tenantId, decodedSessionId, currentUserId);
      if (!session) return fail("SESSION_NOT_FOUND", "对练会话不存在或不属于当前用户。", 404);
    }

    const detail = getTrainingRecordBySessionId(
      tenantId,
      decodedSessionId,
      isAdmin ? undefined : { userId: currentUserId },
    );

    // 恢复兜底：仅对学员本人的会话生效；管理员直查记录不做自动恢复
    if (!detail && session && session.status === "completed") {
      const lastAt = recoverThrottle.get(decodedSessionId) ?? 0;
      if (Date.now() - lastAt >= RECOVER_MIN_INTERVAL_MS) {
        const history = parseSessionHistory(session.historyJson);
        if (history.length >= 2) {
          recoverThrottle.set(decodedSessionId, Date.now());
          const sceneDetail = getSceneDetail(tenantId, session.sceneId);
          const config = getDefaultAiProvider(tenantId);
          if (sceneDetail && config && config.status === "enabled" && config.apiKeyEncrypted && config.baseUrl) {
            void scoreAndSaveRecordSafe(
              tenantId,
              currentUserId ?? null,
              { sceneId: session.sceneId, sessionId: decodedSessionId, messages: history, startedAt: session.startedAt },
              sceneDetail,
              config,
              createTraceId(),
            );
          }
        }
      }
    }
    return ok(detail ?? null);
  } catch (error) {
    return handleRouteError(error);
  }
}
