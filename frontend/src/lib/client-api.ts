export const bridgeBaseUrl =
  process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:5050";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function apiFetch(path: string, init?: RequestInit) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${apiBaseUrl}${normalizedPath}`, {
    ...init,
    credentials: "include",
    headers:
      init?.body instanceof FormData
        ? init.headers
        : {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
          },
  });
}

/**
 * Fetch trực tiếp tới Python bridge service (port 5050) — KHÔNG dùng apiBaseUrl.
 * Dùng cho các endpoint liên quan tới RFID scan realtime (start/poll/cancel).
 */
export async function bridgeFetch(path: string, init?: RequestInit) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${bridgeBaseUrl}${normalizedPath}`, {
    ...init,
    credentials: "omit",
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers || {}),
    },
  });
}

/**
 * Chuẩn hoá URL API: bảo đảm luôn có hậu tố /api, không trùng dấu "/" và
 * có fallback localhost khi thiếu NEXT_PUBLIC_API_URL.
 * (Port từ lib/api.ts — giữ nguyên hành vi cũ của các trang dùng lib/api.)
 */
export function buildApiUrlWithApiBase(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    return `http://localhost:4000/api${normalizedPath}`;
  }

  return baseUrl.endsWith("/api")
    ? `${baseUrl}${normalizedPath}`
    : `${baseUrl}/api${normalizedPath}`;
}

/**
 * apiFetch dựa trên buildApiUrlWithApiBase (port nguyên vẹn từ lib/api.ts,
 * tách tên riêng để không đổi hành vi của apiFetch hiện có cho 60+ consumer).
 */
export async function apiFetchWithApiBase(path: string, init?: RequestInit) {
  return fetch(buildApiUrlWithApiBase(path), {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
}
