import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.stockbit.com",
        pathname: "/logos/companies/**",
      },
    ],
  },
};

export default nextConfig;
