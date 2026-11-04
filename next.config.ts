import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const origin = process.env.API_ORIGIN || "http://localhost:3001";
    return [
      { source: "/api/v1/:path*", destination: `${origin}/api/v1/:path*` },
      { source: "/uploads/:path*", destination: `${origin}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
