import { defaultTenantCode } from "@zxt/shared";
import { ensureDb, getTenantByCode, getUserBySessionToken } from "@zxt/database";
import { getAuthCookieToken } from "./auth-cookie";
import { HttpError } from "./response";

export function getBearerToken(request?: Request) {
  const authorization = request?.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) return token;
  return getAuthCookieToken(request);
}

function hostnameOf(value: string) {
  if (!value) return "";
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value).hostname.toLowerCase();
    return value.split(":")[0]?.replace(/^\[|\]$/g, "").toLowerCase() || "";
  } catch {
    return "";
  }
}

function isDevTenantHost(hostname: string) {
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return true;
  const extraHosts = (process.env.DEV_TENANT_HEADER_HOSTS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return extraHosts.includes(hostname);
}

function canUseDevTenantHeader(request?: Request) {
  if (process.env.ALLOW_DEV_TENANT_HEADER !== "true") return false;
  const host = hostnameOf(request?.headers.get("host") || "");
  const origin = hostnameOf(request?.headers.get("origin") || "");
  return isDevTenantHost(host) || isDevTenantHost(origin);
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

  if (canUseDevTenantHeader(request)) {
    const tenantCode = request?.headers.get("x-tenant-code") || process.env.DEFAULT_TENANT_CODE || defaultTenantCode;
    const tenant = getTenantByCode(tenantCode);

    if (!tenant) {
      throw new HttpError("TENANT_NOT_FOUND", `租户 ${tenantCode} 不存在，请先执行 npm.cmd run setup 初始化本地数据库。`, 404);
    }

    return { tenant, tenantId: tenant.id, tenantCode, user: null };
  }

  throw new HttpError("AUTH_REQUIRED", "请先登录后再访问管理端接口。", 401);
}
