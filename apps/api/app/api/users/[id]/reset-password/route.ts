import { z } from "zod";
import { resetUserPassword } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAdmin(request);
    const { id } = await context.params;
    const body = resetPasswordSchema.parse(await request.json());
    const user = resetUserPassword(tenantId, id, body.newPassword);
    if (!user) return fail("USER_NOT_FOUND", "用户不存在或已删除。", 404);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
