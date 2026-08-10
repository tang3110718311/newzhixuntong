/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@zxt/database", "@zxt/shared", "@zxt/ai-provider"],
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