import { getCompanyBoardData } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    return ok(getCompanyBoardData(tenantId));
  } catch (error) {
    return handleRouteError(error);
  }
}
