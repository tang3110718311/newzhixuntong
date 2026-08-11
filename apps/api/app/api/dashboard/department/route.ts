import { getDepartmentBoardData } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    return ok(getDepartmentBoardData(tenantId, orgId));
  } catch (error) {
    return handleRouteError(error);
  }
}
