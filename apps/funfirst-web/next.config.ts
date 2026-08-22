import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@linkall/ui", "@linkall/brands", "@linkall/backend"],
  // Domain mapping:
  //   battleloco.com  → /battle-loco
  //   wrestleloco.com → /wrestle-loco
  // Add custom domains in Vercel project settings for funfirst-web.
  // Formats live at /{slug}/{performances,performance,games}.
  // /locos is the index. Old Comedy Loco aliases and /locos/{slug}/... redirect.
  async redirects() {
    return [
      {
        source: "/performances",
        destination: "/comedy-loco/performances",
        permanent: true,
      },
      {
        source: "/performance",
        destination: "/comedy-loco/performance",
        permanent: true,
      },
      {
        source: "/performance/screens/:id",
        destination: "/comedy-loco/performance/screens/:id",
        permanent: true,
      },
      {
        source: "/performance/overlay/:kind",
        destination: "/comedy-loco/performance/overlay/:kind",
        permanent: true,
      },
      {
        source: "/games",
        destination: "/comedy-loco/games",
        permanent: true,
      },
      {
        source: "/locos/:slug/performances",
        destination: "/:slug/performances",
        permanent: true,
      },
      {
        source: "/locos/:slug/games",
        destination: "/:slug/games",
        permanent: true,
      },
      {
        source: "/locos/:slug/designer",
        destination: "/:slug/designer",
        permanent: true,
      },
      {
        source: "/locos/:slug/player",
        destination: "/:slug/player",
        permanent: true,
      },
      {
        source: "/locos/:slug/performance/preview",
        destination: "/:slug/performance/preview",
        permanent: true,
      },
      {
        source: "/locos/:slug/performance/screens/:id",
        destination: "/:slug/performance/screens/:id",
        permanent: true,
      },
      {
        source: "/locos/:slug/performance/overlay/:kind",
        destination: "/:slug/performance/overlay/:kind",
        permanent: true,
      },
      {
        source: "/locos/:slug/performance",
        destination: "/:slug/performance",
        permanent: true,
      },
      {
        source: "/locos/:slug",
        destination: "/:slug",
        permanent: true,
      },
    ];
  },
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
