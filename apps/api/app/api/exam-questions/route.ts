import { examQuestionInputSchema } from "@zxt/shared";
import {
  addExamQuestion,
  listExamQuestions,
  updateExamQuestion,
  deleteExamQuestion,
} from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireTrainingManager } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const url = new URL(request.url);
    const bankId = url.searchParams.get("bankId") || undefined;
    return ok(listExamQuestions(tenantId, bankId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const body = examQuestionInputSchema.parse(await request.json());
    const detail = addExamQuestion(tenantId, body);
    if (!detail) return fail("QUESTION_CREATE_FAILED", "题目创建失败。", 400);
    return ok(detail, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return fail("QUESTION_ID_REQUIRED", "缺少题目 ID。", 400);
    const body = examQuestionInputSchema.parse(await request.json());
    const detail = updateExamQuestion(tenantId, id, body);
    if (!detail) return fail("QUESTION_NOT_FOUND", "题目不存在或已删除。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return fail("QUESTION_ID_REQUIRED", "缺少题目 ID。", 400);
    deleteExamQuestion(tenantId, id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
