import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@linkall/ui", "@linkall/brands", "@linkall/backend"],
  // Named shows: homeshow.com → /homeshow, weddingloco.com → /wedding-loco,
  // barloco.com → /bar-loco.
  // Formats live at /{slug}/{performances,performance,designer,player,games}.
  async rewrites() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "homeshow.com" }],
        destination: "/homeshow",
      },
      {
        source: "/",
        has: [{ type: "host", value: "www.homeshow.com" }],
        destination: "/homeshow",
      },
      {
        source: "/",
        has: [{ type: "host", value: "weddingloco.com" }],
        destination: "/wedding-loco",
      },
      {
        source: "/",
        has: [{ type: "host", value: "www.weddingloco.com" }],
        destination: "/wedding-loco",
      },
      {
        source: "/",
        has: [{ type: "host", value: "barloco.com" }],
        destination: "/bar-loco",
      },
      {
        source: "/",
        has: [{ type: "host", value: "www.barloco.com" }],
        destination: "/bar-loco",
      },
    ];
  },
  // /locos is the index. Old /locos/{slug}/... redirect to /{slug}/...
  async redirects() {
    return [
      {
        source: "/wedding-loco/ceremony/:path*",
        destination: "/wedding-ceremony/:path*",
        permanent: true,
      },
      {
        source: "/wedding-loco/ceremony",
        destination: "/wedding-ceremony",
        permanent: true,
      },
      {
        source: "/wedding-loco/reception/:path*",
        destination: "/wedding-reception/:path*",
        permanent: true,
      },
      {
        source: "/wedding-loco/reception",
        destination: "/wedding-reception",
        permanent: true,
      },
      {
        source: "/wedding-loco/performances",
        destination: "/wedding-reception/performances",
        permanent: true,
      },
      {
        source: "/wedding-loco/performance",
        destination: "/wedding-reception/performance",
        permanent: true,
      },
      {
        source: "/wedding-loco/games",
        destination: "/wedding-reception/games",
        permanent: true,
      },
      {
        source: "/wedding-loco/designer",
        destination: "/wedding-reception/designer",
        permanent: true,
      },
      {
        source: "/wedding-loco/player",
        destination: "/wedding-reception/player",
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
};

export default nextConfig;
