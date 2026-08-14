import { ensureDb, revokeSessionToken } from "@zxt/database";
import { clearAuthCookie } from "@/lib/auth-cookie";
import { getBearerToken } from "@/lib/tenant";
import { handleRouteError, ok } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureDb();
    const token = getBearerToken(request);
    const response = ok(revokeSessionToken(token));
    clearAuthCookie(response);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
