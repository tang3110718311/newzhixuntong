import { createMaterialSchema } from "@zxt/shared";
import { createMaterial, listMaterials } from "@zxt/database/client";
import { handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    return ok(listMaterials(tenantId, parsePagination(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = createMaterialSchema.parse(await request.json());
    return ok(createMaterial(tenantId, body), undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}