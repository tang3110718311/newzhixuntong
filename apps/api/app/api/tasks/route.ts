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
    // 严格按当前登录用户过滤：仅企业管理员（tenant_admin）返回全部任务，其余角色（含 trainer/learner）只返回本人参与的任务
    const isAdmin = user?.roleCode === "tenant_admin";
    const learnerScope = !isAdmin && user?.id
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
