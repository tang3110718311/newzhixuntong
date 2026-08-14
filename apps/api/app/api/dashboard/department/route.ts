import { getDepartmentBoardData } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    return ok(getDepartmentBoardData(tenantId, orgId));
  } catch (error) {
    return handleRouteError(error);
  }
}
