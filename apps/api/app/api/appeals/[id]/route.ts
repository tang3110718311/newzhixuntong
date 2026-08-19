import { handleAppealSchema } from "@zxt/shared";
import { handleAppeal } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireTrainingManager } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const { id } = await context.params;
    const body = handleAppealSchema.parse(await request.json());
    const appeal = handleAppeal(tenantId, id, body);
    if (!appeal) return fail("APPEAL_NOT_FOUND", "申诉不存在或已删除。", 404);
    return ok(appeal);
  } catch (error) {
    return handleRouteError(error);
  }
}
