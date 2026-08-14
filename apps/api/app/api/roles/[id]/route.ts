import { updateRoleSchema } from "@zxt/shared";
import { deleteRole, updateRole } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAdmin(request);
    const { id } = await context.params;
    const body = updateRoleSchema.parse(await request.json());
    const role = updateRole(tenantId, id, body);
    if (!role) return fail("ROLE_NOT_FOUND", "角色不存在或已删除。", 404);
    return ok(role);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAdmin(request);
    const { id } = await context.params;
    const role = updateRole(tenantId, id, {});
    if (!role) return fail("ROLE_NOT_FOUND", "角色不存在或已删除。", 404);
    deleteRole(tenantId, id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
