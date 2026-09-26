import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  typedRoutes: false,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    authInterrupts: true,
  },
};

export default nextConfig;
