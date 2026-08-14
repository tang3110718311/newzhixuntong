import { updateTaskStatus } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { requireTrainingManager } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const { id } = await context.params;
    return ok(updateTaskStatus(tenantId, id, "published"));
  } catch (error) {
    return handleRouteError(error);
  }
}
