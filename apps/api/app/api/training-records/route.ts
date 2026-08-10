import { createTrainingRecordSchema } from "@zxt/shared";
import { createTrainingRecord, listTrainingRecords } from "@zxt/database/client";
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
    const filterUserId = url.searchParams.get("filterUserId") || undefined;
    // 非管理员只看自己
    const isAdmin = user?.roleCode === "tenant_admin";
    const userId = !isAdmin && user ? user.id : undefined;
    return ok(listTrainingRecords(tenantId, { ...parsePagination(request), userId, sceneId, filterUserId }));
  } catch (error) {
    return handleRouteError(error);
  }
}
export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = createTrainingRecordSchema.parse(await request.json());
    const detail = createTrainingRecord(tenantId, body);
    if (!detail) return fail("TRAINING_RECORD_REF_NOT_FOUND", "关联任务、场景或学员不存在。", 404);
    return ok(detail, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
