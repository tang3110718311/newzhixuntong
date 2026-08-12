import { z } from "zod";
import { batchDeleteScenes } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const batchDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export async function DELETE(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = batchDeleteSchema.parse(await request.json());
    const deleted = batchDeleteScenes(tenantId, body.ids);
    return ok({ deleted });
  } catch (error) {
    return handleRouteError(error);
  }
}
