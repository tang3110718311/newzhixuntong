import { createRoleSchema } from "@zxt/shared";
import { createRole, listRoles } from "@zxt/database";
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
    return ok(listRoles(tenantId, { ...pagination, status: url.searchParams.get("status") || "" }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = createRoleSchema.parse(await request.json());
    const role = createRole(tenantId, body);
    if (!role) return fail("ROLE_CREATE_FAILED", "角色创建失败。", 400);
    return ok(role, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}