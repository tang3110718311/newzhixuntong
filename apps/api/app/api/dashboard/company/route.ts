import { getCompanyBoardData } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    return ok(getCompanyBoardData(tenantId));
  } catch (error) {
    return handleRouteError(error);
  }
}
