import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { logAiCall } from "@zxt/database";
import { createTraceId, fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { assertRateLimit, getClientIp } from "@/lib/rate-limit";

const ZXT_TTS_TIMEOUT_MS = Number(process.env.ZXT_TTS_TIMEOUT_MS || 30000);
// 智训通自有 TTS 服务（OpenAI 兼容 /v1/audio/speech，实测 171.109.109.90:10030 可用）；未配置时 TTS 不可用
const ZXT_TTS_BASE_URL = stripTrailingSlash(process.env.ZXT_TTS_BASE_URL || "");

const ALLOWED_EMOTIONS = [
  "angry", "urgent", "anxious", "sad", "satisfied",
  "cheerful", "calm", "serious", "polite", "default",
];

// ---- TTS 缓存：内存 LRU + 落盘持久化 ----
// 同一文本（开场白、高频问答）重复请求直接命中秒回，避免重复调用合成服务。
// 内存缓存 dev 热更新/重启会重置，因此同时落盘（apps/api/.tts-cache/），重启后仍可命中。
const TTS_CACHE_MAX = 120; // 内存最多缓存 120 条（每条约几十 KB base64，总量可控）
const TTS_DISK_DIR = join(process.cwd(), ".tts-cache"); // 落盘缓存目录（已加入 .gitignore）
const TTS_DISK_MAX_FILES = 500; // 磁盘文件上限，超出删除最旧文件
type TtsCacheEntry = { audioBase64: string; format: string; engine: string };
const ttsCache = new Map<string, TtsCacheEntry>();

function ttsCacheKey(text: string, voice: string, emotion: string): string {
  // 文本可能较长，直接拼 key 即可（Map 内部哈希），无需额外 hash 计算
  return `${voice}|${emotion}|${text}`;
}
function ttsCacheFilePath(key: string): string {
  // 文件名用 sha256(key)，避免文件系统非法字符/超长文件名
  const hash = createHash("sha256").update(key).digest("hex");
  return join(TTS_DISK_DIR, `${hash}.json`);
}
function ttsCacheGet(key: string): TtsCacheEntry | null {
  // 1. 内存 LRU 命中
  const hit = ttsCache.get(key);
  if (hit) {
    // LRU：命中后刷新到队尾
    ttsCache.delete(key);
    ttsCache.set(key, hit);
    return hit;
  }
  // 2. 磁盘持久化缓存（重启后仍可命中）：命中后回填内存
  try {
    const file = ttsCacheFilePath(key);
    if (!existsSync(file)) return null;
    const entry = JSON.parse(readFileSync(file, "utf-8")) as TtsCacheEntry;
    if (entry && typeof entry.audioBase64 === "string" && typeof entry.format === "string") {
      ttsCacheSet(key, entry);
      return entry;
    }
  } catch {
    /* 磁盘缓存损坏/不可读时忽略，走合成 */
  }
  return null;
}
function ttsCacheSet(key: string, entry: TtsCacheEntry) {
  // 1. 写内存 LRU
  ttsCache.delete(key);
  ttsCache.set(key, entry);
  if (ttsCache.size > TTS_CACHE_MAX) {
    const oldest = ttsCache.keys().next().value;
    if (oldest !== undefined) ttsCache.delete(oldest);
  }
  // 2. 落盘（异步写入，不阻塞响应；失败不影响功能）
  try {
    if (!existsSync(TTS_DISK_DIR)) mkdirSync(TTS_DISK_DIR, { recursive: true });
    const file = ttsCacheFilePath(key);
    if (!existsSync(file)) {
      // 磁盘文件数超限时清理最旧的，防止无限增长
      try {
        const files = readdirSync(TTS_DISK_DIR)
          .filter((f) => f.endsWith(".json"))
          .map((f) => join(TTS_DISK_DIR, f))
          .sort((a, b) => {
            const ta = statSync(a).mtimeMs;
            const tb = statSync(b).mtimeMs;
            return ta - tb;
          });
        while (files.length >= TTS_DISK_MAX_FILES) {
          const oldest = files.shift();
          if (oldest) unlinkSync(oldest);
        }
      } catch { /* 清理失败忽略 */ }
      writeFileSync(file, JSON.stringify(entry), "utf-8");
    }
  } catch {
    /* 磁盘写入失败忽略（内存缓存仍可用） */
  }
}

const ttsRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().max(80).default("xiaoyan"),
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

    // 0. 命中缓存：直接返回，省去合成耗时（开场白/高频句重复播报时从 4-7s → 毫秒级）
    const cacheKey = ttsCacheKey(text, voice, emotion);
    const cached = ttsCacheGet(cacheKey);
    if (cached) {
      logAiCall({ tenantId, providerType: "tts", modelName: "tts-cache", bizType: "tts_synthesize", durationMs: Date.now() - started, success: true, traceId });
      return ok({ ...cached, cached: true }, traceId);
    }

    // 仅使用智训通自有 TTS 服务（OpenAI 兼容 /v1/audio/speech）
    if (!ZXT_TTS_BASE_URL) {
      return fail("TTS_NOT_CONFIGURED", "未配置 TTS 服务地址（ZXT_TTS_BASE_URL），语音合成不可用。", 503, traceId);
    }
    try {
      const legacyResult = await synthesizeWithLegacyTts({ text, voice, emotion });
      if (!legacyResult.ok || !legacyResult.audioBase64) {
        throw new Error(legacyResult.error || "zxt-legacy-tts returned empty audio");
      }
      logAiCall({ tenantId, providerType: "tts", modelName: "zxt-legacy-tts", bizType: "tts_synthesize", durationMs: Date.now() - started, success: true, traceId });
      const result = {
        audioBase64: legacyResult.audioBase64,
        format: legacyResult.format || "wav",
        engine: "zxt-legacy-tts",
      };
      ttsCacheSet(cacheKey, result);
      return ok(result, traceId);
    } catch (legacyError) {
      return fail("TTS_FAILED", `语音合成失败：${errorMessage(legacyError) || "unknown"}`, 502, traceId);
    }
  } catch (error) {
    return handleRouteError(error, traceId);
  }
}

const LEGACY_DEFAULT_VOICE = "xiaoyan";

function toLegacyVoice(voice: string): string {
  const v = (voice || "").trim();
  if (!v) return LEGACY_DEFAULT_VOICE;
  // 新版 chattts/Neural 音色名映射到旧版默认音色；旧版音色（如 xiaoyan）原样透传
  if (v.startsWith("chattts-") || v.includes("Neural")) {
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

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}
