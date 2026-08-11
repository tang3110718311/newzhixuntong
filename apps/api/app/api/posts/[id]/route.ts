import { updatePostSchema } from "@zxt/shared";
import { deletePost, updatePost } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const body = updatePostSchema.parse(await request.json());
    const post = updatePost(tenantId, id, body);
    if (!post) return fail("POST_NOT_FOUND", "岗位不存在或已删除。", 404);
    return ok(post);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const post = updatePost(tenantId, id, {});
    if (!post) return fail("POST_NOT_FOUND", "岗位不存在或已删除。", 404);
    deletePost(tenantId, id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}