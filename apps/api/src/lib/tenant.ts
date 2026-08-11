import { defaultTenantCode } from "@zxt/shared";
import { ensureDb, getTenantByCode, getUserBySessionToken } from "@zxt/database";
import { HttpError } from "./response";

export function getBearerToken(request?: Request) {
  const authorization = request?.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : "";
}

export async function getTenantContext(request?: Request) {
  // Ensure sql.js database is initialized before any repository calls
  await ensureDb();

  const token = getBearerToken(request);
  if (token) {
    const user = getUserBySessionToken(token);
    if (!user) {
      throw new HttpError("SESSION_INVALID", "登录已过期，请重新登录。", 401);
    }

    return {
      tenant: { id: user.tenantId, name: user.tenantName, code: user.tenantCode, status: "active" },
      tenantId: user.tenantId,
      tenantCode: user.tenantCode,
      user,
    };
  }

  if (process.env.ALLOW_DEV_TENANT_HEADER === "true") {
    const tenantCode = request?.headers.get("x-tenant-code") || process.env.DEFAULT_TENANT_CODE || defaultTenantCode;
    const tenant = getTenantByCode(tenantCode);

    if (!tenant) {
      throw new HttpError("TENANT_NOT_FOUND", `租户 ${tenantCode} 不存在，请先执行 npm.cmd run setup 初始化本地数据库。`, 404);
    }

    return { tenant, tenantId: tenant.id, tenantCode, user: null };
  }

  throw new HttpError("AUTH_REQUIRED", "请先登录后再访问管理端接口。", 401);
}