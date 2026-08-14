import { updateTenantSettingsSchema } from "@zxt/shared";
import { getTenantSettings, updateTenantSettings } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const settings = getTenantSettings(tenantId);
    if (!settings) return fail("TENANT_NOT_FOUND", "租户不存在或已删除。", 404);
    return ok(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const body = updateTenantSettingsSchema.parse(await request.json());
    const settings = updateTenantSettings(tenantId, body);
    if (!settings) return fail("TENANT_NOT_FOUND", "租户不存在或已删除。", 404);
    return ok(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}
