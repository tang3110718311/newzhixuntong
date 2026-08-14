import { handleRouteError, HttpError } from "@/lib/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    throw new HttpError("SMS_CODE_DISABLED", "当前登录使用图形验证码，请调用 /api/auth/captcha。", 410);
  } catch (error) {
    return handleRouteError(error);
  }
}
