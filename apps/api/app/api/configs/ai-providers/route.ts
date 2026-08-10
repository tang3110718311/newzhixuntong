import { updateAiProviderSchema } from "@zxt/shared";
import { listAiProviders, upsertDefaultAiProvider } from "@zxt/database/client";
import { handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    return ok({ items: listAiProviders(tenantId) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const body = updateAiProviderSchema.parse(await request.json());
    return ok({ items: upsertDefaultAiProvider(tenantId, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}