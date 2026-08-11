import { createPostSchema } from "@zxt/shared";
import { createPost, listPosts } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { parsePagination } from "@/lib/pagination";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const pagination = parsePagination(request);
    const url = new URL(request.url);
    return ok(listPosts(tenantId, { ...pagination, status: url.searchParams.get("status") || "" }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = createPostSchema.parse(await request.json());
    const post = createPost(tenantId, body);
    if (!post) return fail("POST_CREATE_FAILED", "岗位创建失败。", 400);
    return ok(post, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}