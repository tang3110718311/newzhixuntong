import { updateTaskStatus } from "@zxt/database/client";
import { handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    return ok(updateTaskStatus(tenantId, id, "published"));
  } catch (error) {
    return handleRouteError(error);
  }
}