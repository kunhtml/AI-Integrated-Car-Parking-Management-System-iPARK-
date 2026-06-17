export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    return `http://localhost:4000/api${normalizedPath}`;
  }

  return baseUrl.endsWith("/api") ? `${baseUrl}${normalizedPath}` : `${baseUrl}/api${normalizedPath}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(buildApiUrl(path), {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
}
