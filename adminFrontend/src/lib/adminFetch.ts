"use client";

/**
 * A fetch wrapper for adminFrontend to execute API calls against coreEngine
 * with automatic bearer authorization headers and base URL handling.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let url = input.toString();

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

  // Prepend API base URL for relative paths
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  const headers = new Headers(init?.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
