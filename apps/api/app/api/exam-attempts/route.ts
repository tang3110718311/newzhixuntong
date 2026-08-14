import { createExamAttemptSchema, submitExamAttemptSchema } from "@zxt/shared";
import {
  createExamAttempt,
  listExamAttempts,
  submitExamAttempt,
} from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { isAdminRole } from "@/lib/authz";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const url = new URL(request.url);
    const examId = url.searchParams.get("examId") || undefined;
    const currentUserId = user?.id;
    const isAdmin = isAdminRole(user?.roleCode);
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "Authentication required.", 401);

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
    const isAdmin = isAdminRole(user?.roleCode);
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "Authentication required.", 401);

    const detail = createExamAttempt(tenantId, {
      examId: body.examId,
      userId: isAdmin ? (body.userId ?? currentUserId ?? null) : currentUserId,
    });
    if (!detail) return fail("EXAM_NOT_FOUND", "Exam not found.", 404);
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
    if (!attemptId) return fail("ATTEMPT_ID_REQUIRED", "Attempt id is required.", 400);

    const currentUserId = user?.id;
    const isAdmin = isAdminRole(user?.roleCode);
    if (!isAdmin && !currentUserId) return fail("AUTH_REQUIRED", "Authentication required.", 401);

    const body = submitExamAttemptSchema.parse(await request.json());
    const detail = submitExamAttempt(
      tenantId,
      attemptId,
      body.answers,
      isAdmin ? undefined : { userId: currentUserId },
    );
    if (!detail) return fail("ATTEMPT_NOT_FOUND", "Attempt not found, unauthorized, or already completed.", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
