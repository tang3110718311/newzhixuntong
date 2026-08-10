import { execFile } from "child_process";
import { unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { z } from "zod";
import { logAiCall } from "@zxt/database/client";
import { createTraceId, fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

const execFileAsync = promisify(execFile);

const PYTHON = process.env.TTS_PYTHON_BIN || "python";
const SYNTH_SCRIPT = join(process.cwd(), "tts_synth.py");
const SHERPA_TTS_BASE_URL = stripTrailingSlash(
  process.env.SHERPA_TTS_BASE_URL || "http://localhost:8180",
);
const CHAT_TTS_BASE_URL = stripTrailingSlash(
  process.env.CHAT_TTS_BASE_URL || process.env.CHATTS_BASE_URL || "http://localhost:8179",
);
const SHERPA_TTS_TIMEOUT_MS = Number(process.env.SHERPA_TTS_TIMEOUT_MS || 15000);
const CHAT_TTS_TIMEOUT_MS = Number(process.env.CHAT_TTS_TIMEOUT_MS || 60000);
const EDGE_TTS_TIMEOUT_MS = Number(process.env.EDGE_TTS_TIMEOUT_MS || 25000);

const ALLOWED_EMOTIONS = [
  "angry", "urgent", "anxious", "sad", "satisfied",
  "cheerful", "calm", "serious", "polite", "default",
];

const ttsRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().max(80).default("chattts-female-306"),
  emotion: z.enum(ALLOWED_EMOTIONS as [string, ...string[]]).default("default"),
});

type TtsPayload = {
  text: string;
  voice: string;
  emotion: string;
};

type TtsEngineResult = {
  ok?: boolean;
  audioBase64?: string;
  format?: string;
  error?: string;
  engine?: string;
  cached?: boolean;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const traceId = createTraceId();
  const started = Date.now();
  try {
    const { tenantId } = await getTenantContext(request);
    const { text, voice, emotion } = ttsRequestSchema.parse(await request.json());

    // 1. 主引擎：edge-tts（微软云端，自然男女声、情绪丰富、不占本地算力）
    try {
      const edgeResult = await synthesizeWithEdgeTts({
        text,
        voice: toEdgeVoice(voice),
        emotion,
      });
      if (!edgeResult || !edgeResult.ok || !edgeResult.audioBase64) {
        throw new Error(edgeResult?.error || "edge-tts returned empty audio");
      }
      logAiCall({ tenantId, providerType: "tts", modelName: "edge-tts", bizType: "tts_synthesize", durationMs: Date.now() - started, success: true, traceId });
      return ok({
        audioBase64: edgeResult.audioBase64,
        format: edgeResult.format || "mp3",
        engine: "edge-tts",
      }, traceId);
    } catch (edgeError) {
      // 2. 本地降级：sherpa-onnx（离线可用，音质略机械）
      try {
        const sherpaResult = await synthesizeWithSherpaTts({ text, voice, emotion });
        logAiCall({ tenantId, providerType: "tts", modelName: "sherpa-melotts", bizType: "tts_synthesize", durationMs: Date.now() - started, success: true, traceId });
        return ok({
          audioBase64: sherpaResult.audioBase64,
          format: sherpaResult.format || "wav",
          engine: sherpaResult.engine || "sherpa-melotts",
          cached: Boolean(sherpaResult.cached),
        }, traceId);
      } catch (sherpaError) {
        // 3. 兜底：ChatTTS（慢但多声，离线）
        try {
          const chatTtsResult = await synthesizeWithChatTts({ text, voice, emotion });
          logAiCall({ tenantId, providerType: "tts", modelName: "ChatTTS", bizType: "tts_synthesize", durationMs: Date.now() - started, success: true, traceId });
          return ok({
            audioBase64: chatTtsResult.audioBase64,
            format: chatTtsResult.format || "wav",
            engine: chatTtsResult.engine || "chattts",
            cached: Boolean(chatTtsResult.cached),
          }, traceId);
        } catch (_chatTtsError) {
          return fail("TTS_FAILED", `语音合成失败：${errorMessage(edgeError) || errorMessage(sherpaError) || "unknown"}`, 502, traceId);
        }
      }
    }
  } catch (error) {
    return handleRouteError(error, traceId);
  }
}

async function synthesizeWithSherpaTts(payload: TtsPayload): Promise<TtsEngineResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHERPA_TTS_TIMEOUT_MS);
  try {
    const response = await fetch(`${SHERPA_TTS_BASE_URL}/synthesize`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`sherpa-tts HTTP ${response.status}`);
    const result = await response.json() as TtsEngineResult;
    if (!result || result.ok === false || !result.audioBase64) {
      throw new Error(result?.error || "sherpa-tts returned empty audio");
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function synthesizeWithChatTts(payload: TtsPayload): Promise<TtsEngineResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TTS_TIMEOUT_MS);
  try {
    const response = await fetch(`${CHAT_TTS_BASE_URL}/synthesize`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`ChatTTS HTTP ${response.status}`);
    const result = await response.json() as TtsEngineResult;
    if (!result || result.ok === false || !result.audioBase64) {
      throw new Error(result?.error || "ChatTTS returned empty audio");
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function synthesizeWithEdgeTts(payload: TtsPayload): Promise<TtsEngineResult | null> {
  const payloadPath = join(process.cwd(), `tts-req-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  writeJson(payloadPath, payload);
  try {
    const { stdout } = await execFileAsync(
      PYTHON,
      [SYNTH_SCRIPT, payloadPath],
      { timeout: EDGE_TTS_TIMEOUT_MS, cwd: process.cwd() },
    );
    return safeParse(stdout);
  } finally {
    try { unlinkSync(payloadPath); } catch { /* ignore */ }
  }
}

function writeJson(p: string, obj: unknown) {
  writeFileSync(p, JSON.stringify(obj), "utf-8");
}

function safeParse(s: string): TtsEngineResult | null {
  try { return JSON.parse(s.trim()); } catch { return null; }
}

// 前端 voice 名 -> edge-tts 中文声音名（沉稳、自然，男女各若干）
const EDGE_VOICE_MAP: Record<string, string> = {
  // 女声（沉稳）
  "edge-female-0": "zh-CN-XiaoyiNeural",   // 晓伊：沉稳女声
  "edge-female-1": "zh-CN-XiaoxiaoNeural", // 晓晓：清亮女声
  // 男声（沉稳）
  "edge-male-0": "zh-CN-YunyangNeural",    // 云扬：沉稳男声
  "edge-male-1": "zh-CN-YunjianNeural",    // 云健：刚毅男声
};

function toEdgeVoice(voice: string): string {
  const mapped = EDGE_VOICE_MAP[voice];
  if (mapped) return mapped;
  const normalized = (voice || "").toLowerCase();
  if (normalized.includes("male") && !normalized.includes("female")) return "zh-CN-YunyangNeural";
  return "zh-CN-XiaoyiNeural";
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}
