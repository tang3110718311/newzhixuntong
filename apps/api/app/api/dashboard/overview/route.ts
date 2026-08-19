import { getDashboardOverview } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenant, tenantId, user } = await requireAdmin(request);
    const userId = user?.id ?? undefined;
    return ok(getDashboardOverview(tenantId, tenant.name, userId));
  } catch (error) {
    return handleRouteError(error);
  }
}