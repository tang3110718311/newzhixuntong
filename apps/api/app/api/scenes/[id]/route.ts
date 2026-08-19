import { updateSceneSchema } from "@zxt/shared";
import { deleteScene, getSceneDetail, updateSceneDetail } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireTrainingManager } from "@/lib/authz";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const detail = getSceneDetail(tenantId, id);
    if (!detail) return fail("SCENE_NOT_FOUND", "场景不存在或已删除。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const { id } = await context.params;
    const body = updateSceneSchema.parse(await request.json());
    const detail = updateSceneDetail(tenantId, id, {
      name: body.name,
      description: body.description,
      aiRole: body.aiRole,
      learnerRole: body.learnerRole,
      endCondition: body.endCondition,
      interruptCondition: body.interruptCondition,
      dialogueExample: body.dialogueExample,
      initiator: body.initiator,
      scoringRules: body.scoringRules,
    });
    if (!detail) return fail("SCENE_NOT_FOUND", "场景不存在或已删除。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const { id } = await context.params;
    const deleted = deleteScene(tenantId, id);
    if (!deleted) return fail("SCENE_NOT_FOUND", "场景不存在或已删除。", 404);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
