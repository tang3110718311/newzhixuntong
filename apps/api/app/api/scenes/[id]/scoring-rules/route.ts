import { updateScoringRulesSchema } from "@zxt/shared";
import { replaceSceneScoringRules } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireTrainingManager } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const { id } = await context.params;
    const body = updateScoringRulesSchema.parse(await request.json());
    const detail = replaceSceneScoringRules(tenantId, id, body.rules);
    if (!detail) return fail("SCENE_NOT_FOUND", "场景不存在或已删除。", 404);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
