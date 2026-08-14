import { updateUserSchema } from "@zxt/shared";
import { deleteUser, updateUser } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAdmin(request);
    const { id } = await context.params;
    const body = updateUserSchema.parse(await request.json());
    const user = updateUser(tenantId, id, body);
    if (!user) return fail("USER_NOT_FOUND", "用户不存在或已删除。", 404);
    return ok(user);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAdmin(request);
    const { id } = await context.params;
    const existing = updateUser(tenantId, id, {});
    if (!existing) return fail("USER_NOT_FOUND", "用户不存在或已删除。", 404);
    deleteUser(tenantId, id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
