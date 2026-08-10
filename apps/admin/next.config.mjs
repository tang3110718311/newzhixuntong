/** @type {import("next").NextConfig} */
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig = {
  transpilePackages: ["@zxt/shared"],
  basePath,
};

export default nextConfig;
