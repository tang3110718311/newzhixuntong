import { getDefaultAiProvider, getSceneDetail, getTrainingRecordDetail } from "@zxt/database";
import { fail, handleRouteError, ok, createTraceId } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { rebuildRecordOverallScoresFromTurnScores, triggerRecordTurnBackfillSafe } from "@/lib/ai-scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const { id } = await context.params;
    const isAdmin = user?.roleCode === "tenant_admin";
    const currentUserId = user?.id;
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "请先登录后再访问训练记录。", 401);

    const detail = getTrainingRecordDetail(tenantId, id, isAdmin ? undefined : { userId: currentUserId });
    if (!detail) return fail("TRAINING_RECORD_NOT_FOUND", "训练记录不存在或已删除。", 404);
    const sceneDetail = getSceneDetail(tenantId, detail.record.sceneId);
    const config = getDefaultAiProvider(tenantId);
    if (sceneDetail) {
      rebuildRecordOverallScoresFromTurnScores(tenantId, id, sceneDetail);
      if (config?.status === "enabled" && config.baseUrl && config.apiKeyEncrypted && config.modelName) {
        void triggerRecordTurnBackfillSafe(tenantId, id, sceneDetail, config, createTraceId());
      }
    }
    return ok(sceneDetail ? getTrainingRecordDetail(tenantId, id, isAdmin ? undefined : { userId: currentUserId }) ?? detail : detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
