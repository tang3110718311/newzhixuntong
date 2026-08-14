import { switchTenantSchema } from "@zxt/shared";
import { ensureDb, switchTenantSession } from "@zxt/database";
import { getTenantContext } from "@/lib/tenant";
import { setAuthCookie } from "@/lib/auth-cookie";
import { handleRouteError, HttpError, ok } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 切换企业：当前用户手机号在目标租户下直接建立新会话（免重复输密码） */
export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = switchTenantSchema.parse(await request.json());
    const { user } = await getTenantContext(request);
    if (!user) throw new HttpError("AUTH_REQUIRED", "请先登录后再切换企业。", 401);

    const session = switchTenantSession({
      mobile: user.mobile,
      tenantCode: body.tenantCode,
      userAgent: request.headers.get("user-agent") || "",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
    });
    if (!session) {
      throw new HttpError("TENANT_USER_NOT_FOUND", "该手机号在目标企业下不存在可用账号，无法切换。", 404);
    }

    const response = ok(session);
    setAuthCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
