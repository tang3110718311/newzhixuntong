import { createTrainingRecordSchema } from "@zxt/shared";
import { createTrainingRecord, listTrainingRecords } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const url = new URL(request.url);
    const sceneId = url.searchParams.get("sceneId") || undefined;
    const isAdmin = user?.roleCode === "tenant_admin";
    const currentUserId = user?.id;
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "请先登录后再访问训练记录。", 401);
    const userId = isAdmin
      ? (url.searchParams.get("filterUserId") || url.searchParams.get("userId") || undefined)
      : currentUserId;
    return ok(listTrainingRecords(tenantId, { ...parsePagination(request), userId, sceneId }));
  } catch (error) {
    return handleRouteError(error);
  }
}
export async function POST(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const body = createTrainingRecordSchema.parse(await request.json());
    const isAdmin = user?.roleCode === "tenant_admin";
    const currentUserId = user?.id;
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "请先登录后再创建训练记录。", 401);
    const detail = createTrainingRecord(tenantId, isAdmin ? body : { ...body, userId: currentUserId });
    if (!detail) return fail("TRAINING_RECORD_REF_NOT_FOUND", "关联任务、场景或学员不存在。", 404);
    return ok(detail, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
