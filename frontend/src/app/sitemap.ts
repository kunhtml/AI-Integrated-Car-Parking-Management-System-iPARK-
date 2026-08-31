import { MetadataRoute } from "next";

/**
 * Sitemap chỉ liệt kê các trang PUBLIC, crawl được.
 * Khu vực sau đăng nhập (/overview, /sessions, /staff-desk, ...) bị robots.txt
 * chặn và không có giá trị SEO, nên không đưa vào sitemap.
 * (Các URL /dashboard/* cũ không tồn tại trong app — route group "(dashboard)"
 * render mà không có prefix.)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ipark.vn";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
