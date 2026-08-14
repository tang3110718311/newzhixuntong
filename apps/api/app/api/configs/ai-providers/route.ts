import { updateAiProviderSchema } from "@zxt/shared";
import { listAiProviders, upsertDefaultAiProvider } from "@zxt/database";
import { handleRouteError, ok } from "@/lib/response";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    return ok({ items: listAiProviders(tenantId) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireAdmin(request);
    const body = updateAiProviderSchema.parse(await request.json());
    return ok({ items: upsertDefaultAiProvider(tenantId, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}
