import { loginSchema } from "@zxt/shared";
import { ensureDb, loginWithPassword } from "@zxt/database/client";
import { handleRouteError, HttpError, ok } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---- 防暴力破解：内存版失败计数 + 临时锁定（单实例部署适用） ----
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 分钟
const FAILURE_WINDOW_MS = 10 * 60 * 1000; // 10 分钟窗口内计数
const attempts = new Map<string, { count: number; firstAt: number; lockUntil: number }>();

function attemptKey(ip: string, mobile: string) {
  return `${ip}|${mobile}`;
}

function isLocked(key: string): boolean {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (rec.lockUntil > Date.now()) return true;
  if (Date.now() - rec.firstAt > FAILURE_WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return false;
}

function recordFailure(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAt > FAILURE_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, lockUntil: 0 });
  } else {
    rec.count += 1;
    if (rec.count >= MAX_FAILURES) rec.lockUntil = now + LOCK_MS;
  }
}

function clearKey(key: string) {
  attempts.delete(key);
}

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
}

export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = loginSchema.parse(await request.json());
    const key = attemptKey(getClientIp(request), body.mobile);

    if (isLocked(key)) {
      throw new HttpError("LOGIN_ATTEMPTS_EXCEEDED", "登录失败次数过多，请 15 分钟后再试。", 429);
    }

    const session = loginWithPassword({
      ...body,
      userAgent: request.headers.get("user-agent") || "",
      ip: getClientIp(request),
    });
    if (!session) {
      recordFailure(key);
      throw new HttpError("INVALID_CREDENTIALS", "租户、手机号或密码不正确。", 401);
    }

    clearKey(key);
    return ok(session);
  } catch (error) {
    return handleRouteError(error);
  }
}