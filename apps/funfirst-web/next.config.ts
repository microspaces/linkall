import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@linkall/ui", "@linkall/brands", "@linkall/backend"],
  // Domain mapping: battleloco.com → /battle-loco
  // Add battleloco.com as a custom domain in Vercel project settings,
  // then add a rewrite so the root path serves the /battle-loco route.
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
    ];
  },
};

export default nextConfig;
