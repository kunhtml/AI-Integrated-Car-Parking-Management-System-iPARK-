import type { Metadata } from "next";
import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "iPARK - Quản lý bãi đỗ xe thông minh",
    template: "%s | iPARK",
  },
  description: "Nền tảng quản lý vận hành bãi đỗ xe thông minh iPARK.",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "iPARK",
    title: "iPARK - Quản lý bãi đỗ xe thông minh",
    description: "Nền tảng quản lý vận hành bãi đỗ xe thông minh iPARK.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  let apiOrigin: string | null = null;
  if (apiUrl) {
    try {
      apiOrigin = new URL(apiUrl).origin;
    } catch {
      // Ignore malformed optional configuration and render without hints.
    }
  }

  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Áp theme đã lưu trước khi paint để tránh nháy màu (FOUC) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("ipark_theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);document.documentElement.classList.toggle("light",!d);}catch(e){}`,
          }}
        />
        {apiOrigin && <link rel="preconnect" href={apiOrigin} />}
        {apiOrigin && <link rel="dns-prefetch" href={apiOrigin} />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "iPARK",
              description: "Nền tảng quản lý vận hành bãi đỗ xe thông minh.",
              url: process.env.NEXT_PUBLIC_BASE_URL || "https://ipark.vn",
            }),
          }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
