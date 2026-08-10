import { loginSchema } from "@zxt/shared";
import { ensureDb, loginWithPassword } from "@zxt/database/client";
import { handleRouteError, HttpError, ok } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
}

export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = loginSchema.parse(await request.json());
    const session = loginWithPassword({
      ...body,
      userAgent: request.headers.get("user-agent") || "",
      ip: getClientIp(request),
    });
    if (!session) {
      throw new HttpError("INVALID_CREDENTIALS", "租户、手机号或密码不正确。", 401);
    }

    return ok(session);
  } catch (error) {
    return handleRouteError(error);
  }
}