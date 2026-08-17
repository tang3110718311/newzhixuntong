import { createExamSchema, updateExamSchema } from "@zxt/shared";
import {
  createExam,
  listExams,
  getExamDetail,
  updateExam,
  publishExam,
  deleteExam,
} from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireTrainingManager } from "@/lib/authz";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const detail = getExamDetail(tenantId, id);
      if (!detail) return fail("EXAM_NOT_FOUND", "考试不存在或已删除。", 404);
      // 与列表一致：非管理员仅可见已发布考试，草稿/未发布考试对非管理员不可见
      const isAdmin = user?.roleCode === "tenant_admin";
      if (!isAdmin && detail.status !== "published") {
        return fail("EXAM_NOT_FOUND", "考试不存在或已删除。", 404);
      }
      if (user?.roleCode !== "tenant_admin" && user?.roleCode !== "trainer") {
        return ok({
          ...detail,
          questions: detail.questions.map((question) => ({
            ...question,
            answer: "",
            analysis: "",
          })),
        });
      }
      return ok(detail);
    }
    // 严格按当前登录用户过滤：仅企业管理员（tenant_admin）可见全部考试（含草稿），
    // 其余角色（含 trainer/learner）仅可见已发布考试
    const isAdmin = user?.roleCode === "tenant_admin";
    return ok(listExams(tenantId, isAdmin ? {} : { status: "published" }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const body = createExamSchema.parse(await request.json());
    const detail = createExam(tenantId, body);
    if (!detail) return fail("EXAM_CREATE_FAILED", "考试创建失败。", 400);
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
    if (!id) return fail("EXAM_ID_REQUIRED", "缺少考试 ID。", 400);
    const body = updateExamSchema.parse(await request.json());
    const detail = updateExam(tenantId, id, body);
    if (!detail) return fail("EXAM_NOT_FOUND", "考试不存在或已删除。", 404);
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
    if (!id) return fail("EXAM_ID_REQUIRED", "缺少考试 ID。", 400);
    deleteExam(tenantId, id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return fail("EXAM_ID_REQUIRED", "缺少考试 ID。", 400);
    const detail = publishExam(tenantId, id);
    if (!detail) return fail("EXAM_NOT_FOUND", "考试不存在或已删除。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
