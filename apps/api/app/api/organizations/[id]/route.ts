import { updateOrganizationSchema } from "@zxt/shared";
import { deleteOrganization, updateOrganization } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAdmin(request);
    const { id } = await context.params;
    const body = updateOrganizationSchema.parse(await request.json());
    const organization = updateOrganization(tenantId, id, body);
    if (!organization) return fail("ORG_NOT_FOUND", "组织不存在、已删除或上级组织设置有误。", 404);
    return ok(organization);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAdmin(request);
    const { id } = await context.params;
    const result = deleteOrganization(tenantId, id);
    if (result === "NOT_FOUND") return fail("ORG_NOT_FOUND", "组织不存在或已删除。", 404);
    if (result === "HAS_CHILDREN") return fail("ORG_HAS_CHILDREN", "该组织下存在子组织，请先处理子组织后再删除。", 400);
    if (result === "HAS_MEMBERS") return fail("ORG_HAS_MEMBERS", "该组织下存在人员，请先转移或删除人员后再删除。", 400);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
