"use client";

/**
 * A fetch wrapper for adminFrontend to execute API calls against admin backend.
 * Authentication uses the HttpOnly `admin_session` / `refresh_session` cookies the
 * backend sets on login (credentials: "include"); session IDs are never stored in or
 * readable from JavaScript. Refreshes the session automatically on 401/403.
 */

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Tells the admin backend this is the cookie-based web client (no session IDs in JSON bodies). */
export const ADMIN_WEB_HEADERS = { "X-Admin-Client": "web" } as const;

/** Keys that older builds used to keep session IDs in localStorage. */
const LEGACY_SESSION_KEYS = [
  "admin_session_id",
  "admin_refresh_session_id",
  "admin_token",
  "admin_refresh_token",
] as const;

export const ADMIN_USER_KEY = "admin_user";

/** Remove session IDs left in localStorage by older builds. The cookies carry the session. */
export function clearLegacyAdminTokens(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_SESSION_KEYS) localStorage.removeItem(key);
}

export function withAdminHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  for (const [key, value] of Object.entries(ADMIN_WEB_HEADERS)) headers.set(key, value);
  return headers;
}

let refreshPromise: Promise<boolean> | null = null;

/** Clears local state, asks the backend to revoke the session and clear its cookies, and redirects. */
export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  clearLegacyAdminTokens();
  localStorage.removeItem(ADMIN_USER_KEY);

  fetch(`${apiBase}/auth/logout`, {
    method: "POST",
    headers: withAdminHeaders(),
    credentials: "include",
  }).catch(() => {});

  // Dispatch event for auth-context to clear React state
  window.dispatchEvent(new Event("admin:session-expired"));

  // Redirect to login page if currently on any protected page
  if (window.location.pathname !== "/") {
    window.location.href = "/";
  }
}

/** Rotates the session using the HttpOnly refresh cookie. Resolves true on success. */
export function refreshAdminSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${apiBase}/auth/refresh-token`, {
          method: "POST",
          headers: withAdminHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
          credentials: "include",
        });
        return res.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
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

  const doFetch = () =>
    fetch(url, {
      credentials: "include",
      ...init,
      headers: withAdminHeaders(init?.headers),
    });

  const response = await doFetch();

  // If unauthorized (401 or 403) and not an auth endpoint, refresh session & retry
  if (
    (response.status === 401 || response.status === 403) &&
    !url.includes("/auth/")
  ) {
    const refreshed = await refreshAdminSession();

    if (refreshed) {
      const retryResponse = await doFetch();

      // If retry still fails with 401 or 403, force redirect to login
      if (retryResponse.status === 401 || retryResponse.status === 403) {
        clearAdminSession();
      }
      return retryResponse;
    }

    // Refresh failed — clear session and redirect to login
    clearAdminSession();
    return response;
  }

  return response;
}
