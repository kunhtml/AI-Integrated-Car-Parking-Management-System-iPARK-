import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: http://localhost:4000 http://localhost:5050",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:4000 http://localhost:5050 ws://localhost:3000",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "http://localhost:4000/uploads/:path*",
      },
      // Proxy SSE từ backend để vượt qua vấn đề cookie/CORS khi browser
      {
        source: "/api/camera-logs/stream",
        destination: "http://localhost:4000/api/camera-logs/stream",
      },
    ];
  },
  async redirects() {
    // URL cũ dạng /dashboard/<segment> — route group "(dashboard)" render ở gốc
    return [
      { source: "/dashboard", destination: "/overview", permanent: true },
      { source: "/dashboard/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
