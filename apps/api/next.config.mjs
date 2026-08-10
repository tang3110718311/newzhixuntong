/** @type {import("next").NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse"],
  transpilePackages: ["@zxt/database", "@zxt/shared", "@zxt/ai-provider"],
  experimental: {
    // 上传文件（知识库附件）最大 50MB，middleware 存在时默认请求体限制 10MB，需放宽
    middlewareClientMaxBodySize: "60mb",
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