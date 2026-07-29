import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Next.js inside this project instead of discovering the parent
    // workspace, which also contains unrelated Cloudflare Worker sources.
    root: process.cwd(),
  },
};

export default nextConfig;
