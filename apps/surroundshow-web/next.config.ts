import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@linkall/ui", "@linkall/brands", "@linkall/backend"],
};

export default nextConfig;
