import { createSceneSchema } from "@zxt/shared";
import { createScene, listScenes } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const query = parsePagination(request);
    return ok(listScenes(tenantId, {
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword,
      status: query.status,
      mode: query.mode,
      createMode: query.createMode,
      orgId: query.orgId,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId, user: ctxUser } = await getTenantContext(request);
    const body = createSceneSchema.parse(await request.json());
    return ok(createScene(tenantId, { ...body, createdBy: ctxUser?.id ?? null }), undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}