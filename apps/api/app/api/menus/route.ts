import { createMenuSchema } from "@zxt/shared";
import { createMenu, listMenus } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const pagination = parsePagination(request);
    const url = new URL(request.url);
    return ok(listMenus(tenantId, { ...pagination, status: url.searchParams.get("status") || "" }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const body = createMenuSchema.parse(await request.json());
    const menu = createMenu(tenantId, body);
    if (!menu) return fail("MENU_CREATE_FAILED", "菜单创建失败。", 400);
    return ok(menu, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
