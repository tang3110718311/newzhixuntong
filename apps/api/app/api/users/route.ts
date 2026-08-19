import { createUserSchema } from "@zxt/shared";
import { createUser, listUsers } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const url = new URL(request.url);
    const pagination = parsePagination(request);
    return ok(
      listUsers(tenantId, {
        ...pagination,
        status: url.searchParams.get("status") || "",
        roleCode: url.searchParams.get("roleCode") || "",
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const body = createUserSchema.parse(await request.json());
    return ok(createUser(tenantId, body), undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
