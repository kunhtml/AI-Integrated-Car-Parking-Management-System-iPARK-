/** Same-origin media helpers — dùng rewrite Next.js để cookie auth hoạt động với <img> / EventSource. */

export function deviceStreamUrl(deviceId: string) {
  return `/api/devices/${deviceId}/stream`;
}

export function deviceRoiUrl(deviceId: string) {
  return `/api/devices/${deviceId}/roi`;
}

export function recognitionStreamUrl() {
  return `/api/recognition-logs/stream`;
}

/** Chuẩn hoá URL snapshot/upload về same-origin khi có thể. */
export function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return "";
  }
  if (url.startsWith("/")) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (
      parsed.pathname.startsWith("/uploads/") ||
      parsed.pathname.startsWith("/api/")
    ) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // ignore invalid URL
  }
  return url;
}
