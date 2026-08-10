/** @type {import("next").NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "0" },
  // API 服务不加载页面资源，CSP 收紧
  { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" },
];

const nextConfig = {
  serverExternalPackages: ["pdf-parse", "ws"],
  transpilePackages: ["@zxt/database", "@zxt/shared", "@zxt/ai-provider"],
  experimental: {
    // 上传文件（知识库附件）最大 50MB，middleware 存在时默认请求体限制 10MB，需放宽
    middlewareClientMaxBodySize: "60mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // sql.js uses WASM which doesn't work well with Next.js webpack bundling.
      // Mark it as external so Node.js loads it natively at runtime.
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("sql.js");
      }
    }
    return config;
  },
};

export default nextConfig;