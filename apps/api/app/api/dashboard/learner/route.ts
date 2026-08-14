import { getLearnerBoardData } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { isAdminRole } from "@/lib/authz";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const url = new URL(request.url);
    const currentUserId = user?.id;
    if (!currentUserId) return fail("AUTH_REQUIRED", "请先登录后再访问学员看板。", 401);
    const userId = isAdminRole(user?.roleCode)
      ? (url.searchParams.get("userId") || currentUserId)
      : currentUserId;
    return ok(getLearnerBoardData(tenantId, userId));
  } catch (error) {
    return handleRouteError(error);
  }
}
