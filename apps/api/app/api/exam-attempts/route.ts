import { createExamAttemptSchema, submitExamAttemptSchema } from "@zxt/shared";
import {
  createExamAttempt,
  submitExamAttempt,
  listExamAttempts,
} from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const url = new URL(request.url);
    const examId = url.searchParams.get("examId") || undefined;
    return ok(listExamAttempts(tenantId, examId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const body = createExamAttemptSchema.parse(await request.json());
    const detail = createExamAttempt(tenantId, { examId: body.examId, userId: body.userId ?? user?.id ?? null });
    if (!detail) return fail("EXAM_NOT_FOUND", "考试不存在或已删除。", 404);
    return ok(detail, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const url = new URL(request.url);
    const attemptId = url.searchParams.get("id");
    if (!attemptId) return fail("ATTEMPT_ID_REQUIRED", "缺少考试记录 ID。", 400);
    const body = submitExamAttemptSchema.parse(await request.json());
    const detail = submitExamAttempt(tenantId, attemptId, body.answers);
    if (!detail) return fail("ATTEMPT_NOT_FOUND", "考试记录不存在或已完成。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}