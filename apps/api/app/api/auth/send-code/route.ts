import { sendCodeSchema } from "@zxt/shared";
import { handleRouteError, ok } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 本地/演示环境：不真实发送短信，验证码固定为 666666（可用 LOGIN_CODE_OVERRIDE 覆盖）。
// 接入短信服务后：生成随机验证码 → 存入内存/Redis（带过期）→ 调短信 API 下发 → 登录时校验。
export async function POST(request: Request) {
  try {
    const body = sendCodeSchema.parse(await request.json());
    const expiresIn = Number(process.env.LOGIN_CODE_EXPIRES_IN || 300);
    return ok({ mobile: body.mobile, expiresIn, hint: "本地环境验证码：666666" });
  } catch (error) {
    return handleRouteError(error);
  }
}
