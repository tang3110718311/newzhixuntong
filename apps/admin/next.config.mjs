/** @type {import("next").NextConfig} */
const basePath = process.env.NEXT_BASE_PATH || "";

// 自有 FunASR 桥接服务地址(需与前端 NEXT_PUBLIC_FUNASR_WS_URL 保持一致)
const FUNASR_WS_ORIGIN = process.env.NEXT_PUBLIC_FUNASR_WS_URL || "wss://zxt.xingyiwulian.cn:8765";

// API 服务地址（本地开发默认 http://localhost:4000）
const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "0" },
  {
    key: "Content-Security-Policy",
    value:
      `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${FUNASR_WS_ORIGIN} wss://zxt.xingyiwulian.cn:8765 ${API_ORIGIN}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  },
];

const nextConfig = {
  transpilePackages: ["@zxt/shared"],
  basePath,
  // 本地开发: 将 /api/* 代理到独立的 api 服务, 避免 localhost 跨端口触发 CSP connect-src
  // 生产环境走 nginx 反代, 不会命中这些 rewrite
  async rewrites() {
    const apiTarget = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api$/, "")
      || "http://localhost:4000";
    return [
      { source: "/api/:path*", destination: `${apiTarget}/api/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
