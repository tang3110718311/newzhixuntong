import { createOrganizationSchema } from "@zxt/shared";
import { createOrganization, listOrganizations } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const pagination = parsePagination(request);
    const url = new URL(request.url);
    return ok(listOrganizations(tenantId, { ...pagination, type: url.searchParams.get("type") || "" }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const body = createOrganizationSchema.parse(await request.json());
    const organization = createOrganization(tenantId, body);
    if (!organization) return fail("PARENT_ORG_NOT_FOUND", "上级组织不存在或已删除。", 404);
    return ok(organization, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
