import { createIndustryPackageSchema } from "@zxt/shared";
import { createIndustryPackage, listIndustryPackages } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { requireAdmin } from "@/lib/authz";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    return ok(listIndustryPackages(tenantId, parsePagination(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const body = createIndustryPackageSchema.parse(await request.json());
    return ok(createIndustryPackage(tenantId, body), undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
