import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:4000";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/sessions",
        destination: "/dashboard/sessions",
        permanent: false,
      },
      {
        source: "/vehicles",
        destination: "/dashboard/vehicles",
        permanent: false,
      },
      { source: "/wallet", destination: "/dashboard/wallet", permanent: false },
      {
        source: "/profile",
        destination: "/dashboard/profile",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      // Proxy API + MJPEG/SSE + uploads qua same-origin để cookie auth hoạt động với <img> và EventSource
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
