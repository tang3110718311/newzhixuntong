import { loginSchema } from "@zxt/shared";
import { ensureDb, loginWithPassword } from "@zxt/database";
import { setAuthCookie } from "@/lib/auth-cookie";
import { consumeCaptchaToken } from "@/lib/captcha";
import { assertRateLimit, getClientIp } from "@/lib/rate-limit";
import { handleRouteError, HttpError, ok } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 防暴力破解：内存版失败计数 + 临时锁定，单实例部署适用。
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
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

export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = loginSchema.parse(await request.json());
    const ip = getClientIp(request);
    assertRateLimit("auth:login:ip", ip, {
      limit: 30,
      windowMs: 60_000,
      message: "登录请求过于频繁，请稍后再试。",
    });
    const key = attemptKey(ip, body.mobile);

    if (isLocked(key)) {
      throw new HttpError("LOGIN_ATTEMPTS_EXCEEDED", "登录失败次数过多，请 15 分钟后再试。", 429);
    }

    if (!consumeCaptchaToken(body.captchaToken)) {
      recordFailure(key);
      throw new HttpError("INVALID_CAPTCHA", "图形验证码不正确或已过期，请重新验证。", 401);
    }

    const session = loginWithPassword({
      mobile: body.mobile,
      password: body.password,
      userAgent: request.headers.get("user-agent") || "",
      ip,
    });
    if (!session) {
      recordFailure(key);
      throw new HttpError("INVALID_CREDENTIALS", "手机号或密码不正确。", 401);
    }

    clearKey(key);
    const response = ok(session);
    setAuthCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
