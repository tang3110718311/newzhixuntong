/** @type {import("next").NextConfig} */
const basePath = process.env.NEXT_BASE_PATH || "";

// API 完整地址（含 /api 路径，供 api.ts 使用）
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
// CSP connect-src 需要裸 origin（不含路径）。同域相对路径走 'self'，避免在 https 页面调用 http IP。
const API_ORIGIN = API_BASE.startsWith("/")
  ? "'self'"
  : API_BASE.replace(/\/+$/, "").replace(/\/api$/, "") || API_BASE;

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "0" },
  {
    key: "Content-Security-Policy",
    value:
      `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob: blob:; font-src 'self' data:; connect-src 'self' ${API_ORIGIN} wss://zxt.xingyiwulian.cn:8765; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
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
