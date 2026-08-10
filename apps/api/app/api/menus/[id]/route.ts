import { updateMenuSchema } from "@zxt/shared";
import { deleteMenu, updateMenu } from "@zxt/database/client";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const body = updateMenuSchema.parse(await request.json());
    const menu = updateMenu(tenantId, id, body);
    if (!menu) return fail("MENU_NOT_FOUND", "菜单不存在或已删除。", 404);
    return ok(menu);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const menu = updateMenu(tenantId, id, {});
    if (!menu) return fail("MENU_NOT_FOUND", "菜单不存在或已删除。", 404);
    deleteMenu(tenantId, id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}