import { HttpError } from "./response";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  message?: string;
};

const buckets = new Map<string, Bucket>();
let lastCleanupAt = 0;

const defaultTrustedProxyHeaders = ["x-forwarded-for", "x-real-ip"];

function envFlag(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function trustedProxyHeaders() {
  const configured = process.env.TRUSTED_PROXY_HEADERS?.trim();
  if (configured) {
    const normalized = configured.toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return defaultTrustedProxyHeaders;
    if (["false", "0", "no"].includes(normalized)) return [];
    return configured
      .split(",")
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);
  }
  return envFlag("TRUST_PROXY") ? defaultTrustedProxyHeaders : [];
}

function firstHeaderIp(headerValue: string | null) {
  return headerValue?.split(",")[0]?.trim() || "";
}

function runtimeIp(request: Request) {
  const value = (request as Request & { ip?: string }).ip;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function getClientIp(request: Request) {
  for (const header of trustedProxyHeaders()) {
    const value = firstHeaderIp(request.headers.get(header));
    if (value) return value;
  }
  return runtimeIp(request) || "unknown";
}

export function assertRateLimit(scope: string, key: string, options: RateLimitOptions) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const bucketKey = `${scope}:${key || "unknown"}`;
  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > options.limit) {
    throw new HttpError(
      "RATE_LIMITED",
      options.message || "请求过于频繁，请稍后再试。",
      429,
    );
  }
}

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
