import { getTenantContext } from "@/lib/tenant";
import { handleRouteError, ok } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenant, user } = await getTenantContext(request);
    return ok({ tenant, user });
  } catch (error) {
    return handleRouteError(error);
  }
}