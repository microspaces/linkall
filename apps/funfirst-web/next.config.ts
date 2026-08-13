import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@linkall/ui", "@linkall/brands", "@linkall/backend"],
  // Domain mapping:
  //   battleloco.com  → /battle-loco
  //   wrestleloco.com → /wrestle-loco
  // Add custom domains in Vercel project settings for funfirst-web.
  async rewrites() {
    return [
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "battleloco.com",
          },
        ],
        destination: "/battle-loco",
      },
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "wrestleloco.com",
          },
        ],
        destination: "/wrestle-loco",
      },
    ];
  },
};

export default nextConfig;
