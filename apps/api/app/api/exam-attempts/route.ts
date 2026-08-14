import { createExamAttemptSchema, submitExamAttemptSchema } from "@zxt/shared";
import {
  createExamAttempt,
  listExamAttempts,
  submitExamAttempt,
} from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const url = new URL(request.url);
    const examId = url.searchParams.get("examId") || undefined;
    const currentUserId = user?.id;
    const isAdmin = user?.roleCode === "tenant_admin";
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "请先登录后再访问考试记录。", 401);

    return ok(listExamAttempts(tenantId, {
      examId,
      userId: isAdmin ? (url.searchParams.get("userId") || undefined) : currentUserId,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const body = createExamAttemptSchema.parse(await request.json());
    const currentUserId = user?.id;
    const isAdmin = user?.roleCode === "tenant_admin";
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "请先登录后再开始考试。", 401);

    const detail = createExamAttempt(tenantId, {
      examId: body.examId,
      userId: isAdmin ? (body.userId ?? currentUserId ?? null) : currentUserId,
    });
    if (!detail) return fail("EXAM_NOT_FOUND", "考试不存在或已删除。", 404);
    return ok(detail, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const url = new URL(request.url);
    const attemptId = url.searchParams.get("id");
    if (!attemptId) return fail("ATTEMPT_ID_REQUIRED", "缺少考试记录 ID。", 400);

    const currentUserId = user?.id;
    const isAdmin = user?.roleCode === "tenant_admin";
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "请先登录后再提交考试。", 401);

    const body = submitExamAttemptSchema.parse(await request.json());
    const detail = submitExamAttempt(
      tenantId,
      attemptId,
      body.answers,
      isAdmin ? undefined : { userId: currentUserId },
    );
    if (!detail) return fail("ATTEMPT_NOT_FOUND", "考试记录不存在、无权访问或已完成。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
