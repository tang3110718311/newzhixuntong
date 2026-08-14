import { createTaskSchema } from "@zxt/shared";
import { createTask, listTasks } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { requireTrainingManager } from "@/lib/authz";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const pagination = parsePagination(request);
    const isLearner = user?.roleCode === "learner";
    const learnerScope = isLearner && user?.id
      ? { assigneeUserId: user.id, assigneeOrgId: user.orgId }
      : {};
    return ok(listTasks(tenantId, { ...pagination, ...learnerScope }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTrainingManager(request);
    const body = createTaskSchema.parse(await request.json());
    return ok(createTask(tenantId, body), undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
