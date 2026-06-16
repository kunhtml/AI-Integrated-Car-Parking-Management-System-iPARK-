import "./globals.css";

import Providers from "./Providers";

export const metadata = {
  title: "iPARK Management System",
  description: "AI-Integrated Car Parking Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
