/** @type {import("next").NextConfig} */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
