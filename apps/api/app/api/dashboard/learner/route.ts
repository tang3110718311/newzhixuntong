import { getLearnerBoardData } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || user?.id;
    if (!userId) {
      return ok(null);
    }
    return ok(getLearnerBoardData(tenantId, userId));
  } catch (error) {
    return handleRouteError(error);
  }
}
