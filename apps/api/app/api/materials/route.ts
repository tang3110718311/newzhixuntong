import { createMaterialSchema } from "@zxt/shared";
import { createMaterial, listMaterials } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { requireTrainingManager } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    return ok(listMaterials(tenantId, parsePagination(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const body = createMaterialSchema.parse(await request.json());
    return ok(createMaterial(tenantId, body), undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}