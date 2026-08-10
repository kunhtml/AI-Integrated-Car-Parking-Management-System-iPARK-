const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

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
  return fetch(`http://localhost:5050${normalizedPath}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers || {}),
    },
  });
}
