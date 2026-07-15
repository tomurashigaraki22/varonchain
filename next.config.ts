import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict React mode catches subtle bugs before they hit prod
  reactStrictMode: true,

  // Security headers for every route
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // SSE routes must not be cached or buffered
      {
        source: "/api/txline/stream/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-transform" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ];
  },

  // Allow the Solana Explorer image domain (used in share cards)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "explorer.solana.com",
      },
    ],
  },
};

export default nextConfig;
