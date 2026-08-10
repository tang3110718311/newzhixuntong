import { createExamBankSchema, examQuestionInputSchema } from "@zxt/shared";
import {
  createExamBank,
  listExamQuestionBanks,
  addExamQuestion,
  listExamQuestions,
  updateExamQuestion,
  deleteExamQuestion,
  getExamQuestionBankWithQuestions,
  deleteExamBank,
} from "@zxt/database/client";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const url = new URL(request.url);
    const bankId = url.searchParams.get("bankId");
    if (bankId) {
      const detail = getExamQuestionBankWithQuestions(tenantId, bankId);
      if (!detail) return fail("BANK_NOT_FOUND", "题库不存在或已删除。", 404);
      return ok(detail);
    }
    return ok(listExamQuestionBanks(tenantId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = createExamBankSchema.parse(await request.json());
    return ok(createExamBank(tenantId, body), undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = examQuestionInputSchema.parse(await request.json());
    const detail = addExamQuestion(tenantId, body);
    if (!detail) return fail("QUESTION_CREATE_FAILED", "题目创建失败。", 400);
    return ok(detail, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const url = new URL(request.url);
    const bankId = url.searchParams.get("bankId");
    if (!bankId) return fail("BANK_ID_REQUIRED", "缺少题库 ID。", 400);
    deleteExamBank(tenantId, bankId);
    return ok({ id: bankId });
  } catch (error) {
    return handleRouteError(error);
  }
}