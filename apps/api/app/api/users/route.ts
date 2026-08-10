import { createUserSchema } from "@zxt/shared";
import { createUser, listUsers } from "@zxt/database/client";
import { handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    return ok(listUsers(tenantId, parsePagination(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = createUserSchema.parse(await request.json());
    return ok(createUser(tenantId, body), undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}