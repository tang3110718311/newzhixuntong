import { getTenantContext } from "@/lib/tenant";
import { listTenantsByMobile } from "@zxt/database";
import { handleRouteError, HttpError, ok } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 当前登录用户可切换的企业列表（同一手机号关联的所有激活租户） */
export async function GET(request: Request) {
  try {
    const { user } = await getTenantContext(request);
    if (!user) throw new HttpError("AUTH_REQUIRED", "请先登录后再查询可切换企业。", 401);
    const tenants = listTenantsByMobile(user.mobile);
    return ok({ items: tenants, current: user.tenantId });
  } catch (error) {
    return handleRouteError(error);
  }
}
