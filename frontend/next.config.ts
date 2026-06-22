import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/sessions", destination: "/dashboard/sessions", permanent: false },
      { source: "/vehicles", destination: "/dashboard/vehicles", permanent: false },
      { source: "/wallet", destination: "/dashboard/wallet", permanent: false },
      { source: "/profile", destination: "/dashboard/profile", permanent: false },
    ];
  },
};

export default nextConfig;
