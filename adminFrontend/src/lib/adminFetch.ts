"use client";

/**
 * A fetch wrapper for adminFrontend to execute API calls against coreEngine
 * with automatic bearer authorization headers, base URL handling,
 * and automatic token refresh on 401.
 */

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_refresh_token");
}

function saveTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("admin_token", accessToken);
  localStorage.setItem("admin_refresh_token", refreshToken);
}

function clearAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_refresh_token");
  localStorage.removeItem("admin_user");
  // Dispatch event for auth-context to clear React state
  window.dispatchEvent(new Event("admin:session-expired"));
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAdminSession();
    return null;
  }

  try {
    const res = await fetch(`${apiBase}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearAdminSession();
      return null;
    }

    const data = await res.json();
    saveTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    clearAdminSession();
    return null;
  }
}

export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let url = input.toString();

  // Prepend API base URL for relative paths
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  const token = getToken();
  const headers = new Headers(init?.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  // If 401 and not an auth endpoint, try to refresh the token
  if (response.status === 401 && !url.includes("/auth/")) {
    // Deduplicate concurrent refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const newToken = await (refreshPromise || refreshAccessToken());

    if (newToken) {
      // Retry the original request with new token
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      return fetch(url, {
        ...init,
        headers: retryHeaders,
      });
    }

    // Refresh failed — session already cleared by refreshAccessToken
    return response;
  }

  return response;
}
