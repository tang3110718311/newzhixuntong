import { getDashboardOverview } from "@zxt/database/client";
import { handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenant, tenantId, user } = await getTenantContext(request);
    const userId = user?.id ?? undefined;
    return ok(getDashboardOverview(tenantId, tenant.name, userId));
  } catch (error) {
    return handleRouteError(error);
  }
}