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

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
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
