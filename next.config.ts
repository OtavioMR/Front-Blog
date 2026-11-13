import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/confirmar-email", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store, max-age=0" },
    ] }];
  },
  async rewrites() {
    const origin = process.env.API_ORIGIN || "http://localhost:3001";
    return [
      { source: "/api/v1/:path*", destination: `${origin}/api/v1/:path*` },
      { source: "/uploads/:path*", destination: `${origin}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
