import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No output: standalone — incompatible with Cloudflare Pages
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
