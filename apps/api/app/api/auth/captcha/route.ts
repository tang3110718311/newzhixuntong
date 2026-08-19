import { captchaVerifySchema } from "@zxt/shared";
import { handleRouteError, ok } from "@/lib/response";
import { issueCaptchaChallenge, verifyCaptchaChallenge } from "@/lib/captcha";
import { assertRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    assertRateLimit("auth:captcha:issue:ip", ip, {
      limit: 30,
      windowMs: 60_000,
      message: "图形验证码请求过于频繁，请稍后再试。",
    });
    return ok(issueCaptchaChallenge());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    assertRateLimit("auth:captcha:verify:ip", ip, {
      limit: 60,
      windowMs: 60_000,
      message: "图形验证码校验过于频繁，请稍后再试。",
    });
    const body = captchaVerifySchema.parse(await request.json());
    return ok(verifyCaptchaChallenge(body.captchaId, body.positionX));
  } catch (error) {
    return handleRouteError(error);
  }
}
