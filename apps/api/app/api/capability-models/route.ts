import { createCapabilityModelSchema } from "@zxt/shared";
import { createCapabilityModel, listCapabilityModels } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const pagination = parsePagination(request);
    const url = new URL(request.url);
    return ok(listCapabilityModels(tenantId, { ...pagination, industryPackageId: url.searchParams.get("industryPackageId") || "" }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = createCapabilityModelSchema.parse(await request.json());
    const model = createCapabilityModel(tenantId, body);
    if (!model) return fail("INDUSTRY_PACKAGE_NOT_FOUND", "行业包不存在或已删除。", 404);
    return ok(model, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
