import { ok } from "@/lib/response";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ status: "ok", service: "zxt-api", timestamp: new Date().toISOString() });
}