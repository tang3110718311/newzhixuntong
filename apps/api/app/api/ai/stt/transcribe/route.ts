import { z } from "zod";
import { logAiCall } from "@zxt/database";
import { createTraceId, fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { transcribeViaFunasrBridge } from "@/lib/funasr-bridge";

const sttRequestSchema = z.object({
  audioBase64: z.string().min(1),
  format: z.string().default("webm"),
});

const WHISPER_BASE_URL = process.env.WHISPER_BASE_URL || "http://localhost:8178";
const FUNASR_BRIDGE_URL = process.env.FUNASR_BRIDGE_URL || "";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const traceId = createTraceId();
  const started = Date.now();
  try {
    const { tenantId } = await getTenantContext(request);
    const { audioBase64, format } = sttRequestSchema.parse(await request.json());
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // 走自有 FunASR 桥接服务(配置 FUNASR_BRIDGE_URL 时启用)
    if (FUNASR_BRIDGE_URL) {
      const text = await transcribeViaFunasrBridge(FUNASR_BRIDGE_URL, audioBuffer);
      logAiCall({ tenantId, providerType: "stt", modelName: "funasr-bridge", bizType: "audio_transcribe", durationMs: Date.now() - started, success: true, traceId });
      return ok({ text, durationMs: Date.now() - started }, traceId);
    }

    // 原有逻辑:转发到本地 Whisper 服务
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
