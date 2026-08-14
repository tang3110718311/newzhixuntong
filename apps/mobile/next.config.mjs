/** @type {import("next").NextConfig} */
const basePath = process.env.NEXT_BASE_PATH || "";

// API 完整地址（含 /api 路径，供 api.ts 使用）。生产环境不回落到 http 明文地址。
function resolveApiBase() {
  const configured =
    process.env.NEXT_PUBLIC_MOBILE_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";
  if (configured) {
    if (process.env.NODE_ENV === "production" && /^http:\/\//i.test(configured)) return "/api";
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "/api" : "http://localhost:4000/api";
}

const API_BASE = resolveApiBase();
const VOICE_WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL || "wss://zxt.xingyiwulian.cn:8765";

// CSP connect-src 需要裸 origin（不含路径）。同域相对路径走 'self'。
function toCspOrigin(value) {
  if (!value || value.startsWith("/")) return "'self'";
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

const API_ORIGIN = toCspOrigin(API_BASE);
const VOICE_WS_ORIGIN = toCspOrigin(VOICE_WS_URL);
const scriptSrc = ["'self'", "'unsafe-inline'"];
// Keep eval only for local Next dev tooling; production CSP omits it.
if (process.env.NODE_ENV === "development") scriptSrc.push("'unsafe-eval'");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "0" },
  {
    key: "Content-Security-Policy",
    value:
      // TODO: remove unsafe-inline after Next scripts/styles are nonce or hash based.
      `default-src 'self'; script-src ${scriptSrc.join(" ")}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${API_ORIGIN} ${VOICE_WS_ORIGIN}; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  },
];

const nextConfig = {
  transpilePackages: ["@zxt/shared"],
  basePath,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
