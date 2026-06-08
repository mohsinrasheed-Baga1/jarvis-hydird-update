import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  typescript: {
    // Exclude desktop-app folder from type checking (it's a separate Vite app)
    tsconfigPath: "./tsconfig.json",
  },
};

export default nextConfig;
