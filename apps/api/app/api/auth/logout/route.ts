import { ensureDb, revokeSessionToken } from "@zxt/database";
import { getBearerToken } from "@/lib/tenant";
import { handleRouteError, ok } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureDb();
    const token = getBearerToken(request);
    return ok(revokeSessionToken(token));
  } catch (error) {
    return handleRouteError(error);
  }
}