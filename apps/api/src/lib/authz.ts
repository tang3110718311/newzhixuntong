import type { AuthUserRow } from "@zxt/database";
import { HttpError } from "./response";
import { getTenantContext } from "./tenant";

export const ADMIN_ROLE = "tenant_admin";
export const TRAINING_MANAGER_ROLES = [ADMIN_ROLE, "trainer"] as const;

export type TenantContext = Awaited<ReturnType<typeof getTenantContext>>;
export type AuthenticatedTenantContext = Omit<TenantContext, "user"> & { user: AuthUserRow };

export function isAdminRole(roleCode?: string | null) {
  return roleCode === ADMIN_ROLE;
}

export async function requireAuth(request?: Request): Promise<AuthenticatedTenantContext> {
  const context = await getTenantContext(request);
  if (!context.user) {
    throw new HttpError("AUTH_REQUIRED", "请先登录后再访问管理端接口。", 401);
  }
  if (context.user.status !== "active") {
    throw new HttpError("ACCOUNT_DISABLED", "账号已停用，请联系管理员。", 403);
  }
  return context as AuthenticatedTenantContext;
}

export async function requireRoles(request: Request | undefined, roleCodes: readonly string[]) {
  const context = await requireAuth(request);
  if (!roleCodes.includes(context.user.roleCode)) {
    throw new HttpError("FORBIDDEN", "无权限访问该管理接口。", 403);
  }
  return context;
}

export async function requireAdmin(request?: Request) {
  return requireRoles(request, [ADMIN_ROLE]);
}

export async function requireTrainingManager(request?: Request) {
  return requireRoles(request, TRAINING_MANAGER_ROLES);
}
