import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/dashboard/ad-bounties", destination: "/dashboard/market", permanent: false },
      { source: "/dashboard/ad-bounties/:path*", destination: "/dashboard/market", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hzqjzqzmudetapqwubxf.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
