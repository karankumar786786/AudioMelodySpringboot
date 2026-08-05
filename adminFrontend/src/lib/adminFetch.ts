"use client";

import { adminClient } from "./api";

/**
 * A fetch wrapper that reuses the shared OneMelodyClient's Axios instance
 * for our API calls (getting automatic auth headers + token refresh),
 * while falling through to native fetch for external URLs (e.g., ImageKit uploads).
 *
 * Returns a standard Response object to maintain backward compatibility
 * with all admin pages that use `res.ok`, `res.json()`, etc.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let url = input.toString();

  // If the URL is relative or starting with /, prepend NEXT_PUBLIC_API_URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
    url = `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  // Determine if this is our API
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
  const isOurApi = url.startsWith(apiBase);

  if (isOurApi) {
    // Delegate to the shared Axios client for our API (automatic auth + refresh)
    const relativePath = url.replace(apiBase, "");
    const method = (init?.method || "GET").toUpperCase();

    // Parse body if present
    let data: any = undefined;
    if (init?.body) {
      if (typeof init.body === "string") {
        try {
          data = JSON.parse(init.body);
        } catch {
          data = init.body;
        }
      } else if (init.body instanceof FormData) {
        data = init.body;
      } else {
        data = init.body;
      }
    }

    // Parse extra headers
    const extraHeaders: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((value, key) => {
        extraHeaders[key] = value;
      });
    }

    try {
      const axiosRes = await adminClient.api.request({
        url: relativePath,
        method,
        data,
        headers: extraHeaders,
      });

      // Convert Axios response to a native Response for backward compatibility
      return new Response(JSON.stringify(axiosRes.data), {
        status: axiosRes.status,
        statusText: axiosRes.statusText,
        headers: new Headers(axiosRes.headers as any),
      });
    } catch (err: any) {
      if (err.response) {
        return new Response(JSON.stringify(err.response.data), {
          status: err.response.status,
          statusText: err.response.statusText,
          headers: new Headers(err.response.headers as any),
        });
      }
      // Network error or similar
      throw err;
    }
  }

  // For external URLs (e.g., ImageKit uploads), use native fetch with auth header
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
