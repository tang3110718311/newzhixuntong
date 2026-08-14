import { execFile } from "child_process";
import { unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { z } from "zod";
import { logAiCall } from "@zxt/database";
import { createTraceId, fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { assertRateLimit, getClientIp } from "@/lib/rate-limit";

const execFileAsync = promisify(execFile);

const PYTHON = process.env.TTS_PYTHON_BIN || "python";
const SYNTH_SCRIPT = join(process.cwd(), "tts_synth.py");
const EDGE_TTS_TIMEOUT_MS = Number(process.env.EDGE_TTS_TIMEOUT_MS || 25000);
const ZXT_TTS_TIMEOUT_MS = Number(process.env.ZXT_TTS_TIMEOUT_MS || 30000);
// 旧版智训通语音服务(OpenAI 兼容 /v1/audio/speech,实测 171.109.109.90:10030 可用),配置后 AI 说话声音优先走自有服务
const ZXT_TTS_BASE_URL = stripTrailingSlash(process.env.ZXT_TTS_BASE_URL || "");

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
    assertRateLimit("ai:tts:tenant", tenantId, { limit: 90, windowMs: 60_000, message: "语音合成请求过于频繁，请稍后再试。" });
    assertRateLimit("ai:tts:ip", getClientIp(request), { limit: 120, windowMs: 60_000, message: "语音合成请求过于频繁，请稍后再试。" });
    const { text, voice, emotion } = ttsRequestSchema.parse(await request.json());

    // 0. 旧版智训通语音服务(配置 ZXT_TTS_BASE_URL 时优先,失败自动回退 edge-tts)
    if (ZXT_TTS_BASE_URL) {
      try {
        const legacyResult = await synthesizeWithLegacyTts({ text, voice, emotion });
        if (!legacyResult.ok || !legacyResult.audioBase64) {
          throw new Error(legacyResult.error || "zxt-legacy-tts returned empty audio");
        }
        logAiCall({ tenantId, providerType: "tts", modelName: "zxt-legacy-tts", bizType: "tts_synthesize", durationMs: Date.now() - started, success: true, traceId });
        return ok({
          audioBase64: legacyResult.audioBase64,
          format: legacyResult.format || "wav",
          engine: "zxt-legacy-tts",
        }, traceId);
      } catch (legacyError) {
        // 旧版服务不可用时降级到 edge-tts,不影响主流程
      }
    }

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
      return fail("TTS_FAILED", `语音合成失败：${errorMessage(edgeError) || "unknown"}`, 502, traceId);
    }
  } catch (error) {
    return handleRouteError(error, traceId);
  }
}

const LEGACY_DEFAULT_VOICE = "xiaoyan";

function toLegacyVoice(voice: string): string {
  const v = (voice || "").trim();
  if (!v) return LEGACY_DEFAULT_VOICE;
  // 新版音色名映射到旧版默认音色;其余(如 xiaoyan 等旧版音色)原样透传
  if (v.startsWith("chattts-") || v.startsWith("edge-") || v.includes("Neural")) {
    return LEGACY_DEFAULT_VOICE;
  }
  return v;
}

async function synthesizeWithLegacyTts(payload: TtsPayload): Promise<TtsEngineResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ZXT_TTS_TIMEOUT_MS);
  try {
    const response = await fetch(`${ZXT_TTS_BASE_URL}/v1/audio/speech`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: payload.text,
        voice: toLegacyVoice(payload.voice),
        response_format: "wav",
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`zxt-legacy-tts HTTP ${response.status} ${errText.slice(0, 120)}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("zxt-legacy-tts returned empty audio");
    return { ok: true, audioBase64: buffer.toString("base64"), format: "wav", engine: "zxt-legacy-tts" };
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

// 前端 voice 名 -> edge-tts 中文声音名
// 注：云希(Yunxi)虽口语化，但平静/开心情绪下合成失败率高，故男声统一用云扬(所有情绪稳定)
const EDGE_VOICE_MAP: Record<string, string> = {
  // 女声（自然亲切）
  "edge-female-0": "zh-CN-XiaoyiNeural",   // 晓伊：沉稳女声
  "edge-female-1": "zh-CN-XiaoxiaoNeural", // 晓晓：清亮女声
  // 男声（沉稳、稳定）
  "edge-male-0": "zh-CN-YunyangNeural",    // 云扬：沉稳男声（所有情绪合成稳定）
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
