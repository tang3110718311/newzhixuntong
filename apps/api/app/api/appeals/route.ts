import { createAppealSchema } from "@zxt/shared";
import { createAppeal, listAppeals } from "@zxt/database/client";
import { fail, handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    return ok(listAppeals(tenantId, parsePagination(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = createAppealSchema.parse(await request.json());
    const appeal = createAppeal(tenantId, body);
    if (!appeal) return fail("APPEAL_BIZ_NOT_FOUND", "关联训练记录不存在或已删除。", 404);
    return ok(appeal, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
