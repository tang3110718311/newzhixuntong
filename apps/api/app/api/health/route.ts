import { ok } from "@/lib/response";
import { ensureDb } from "@zxt/database";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDb();
  return ok({ status: "ok", service: "zxt-api", timestamp: new Date().toISOString() });
}
