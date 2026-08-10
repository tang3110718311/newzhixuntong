import { createTaskSchema } from "@zxt/shared";
import { createTask, listTasks } from "@zxt/database/client";
import { handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    return ok(listTasks(tenantId, parsePagination(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = createTaskSchema.parse(await request.json());
    return ok(createTask(tenantId, body), undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}