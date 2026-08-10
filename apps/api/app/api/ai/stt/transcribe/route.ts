import { z } from "zod";
import { logAiCall } from "@zxt/database/client";
import { createTraceId, fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

const sttRequestSchema = z.object({
  audioBase64: z.string().min(1),
  format: z.string().default("webm"),
});

const WHISPER_BASE_URL = process.env.WHISPER_BASE_URL || "http://localhost:8178";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const traceId = createTraceId();
  const started = Date.now();
  try {
    const { tenantId } = await getTenantContext(request);
    const { audioBase64, format } = sttRequestSchema.parse(await request.json());

    // 转发到本地 Whisper 服务
    const whisperResponse = await fetch(`${WHISPER_BASE_URL}/asr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: audioBase64, format }),
    });

    if (!whisperResponse.ok) {
      throw new Error(`Whisper 服务返回错误：HTTP ${whisperResponse.status}`);
    }

    const whisperResult = await whisperResponse.json() as { text?: string };
    const text = whisperResult.text || "";

    logAiCall({ tenantId, providerType: "stt", modelName: "whisper-local", bizType: "audio_transcribe", durationMs: Date.now() - started, success: true, traceId });
    return ok({ text, durationMs: Date.now() - started }, traceId);
  } catch (error) {
    return handleRouteError(error, traceId);
  }
}
