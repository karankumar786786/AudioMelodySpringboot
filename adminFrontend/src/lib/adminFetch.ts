"use client";

/**
 * A fetch wrapper for adminFrontend to execute API calls against admin backend
 * using stateful Redis sessions with X-Session-Id headers, cookie handling,
 * and automatic session refresh on 401/403.
 * Zero JWT. Pure Redis session based authentication.
 */

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("admin_session_id") ||
    localStorage.getItem("admin_token")
  );
}

function getRefreshSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("admin_refresh_session_id") ||
    localStorage.getItem("admin_refresh_token")
  );
}

function saveSessions(sessionId: string, refreshSessionId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("admin_session_id", sessionId);
  localStorage.setItem("admin_refresh_session_id", refreshSessionId);
  // Backward compatibility aliases
  localStorage.setItem("admin_token", sessionId);
  localStorage.setItem("admin_refresh_token", refreshSessionId);
}

function clearAdminSession() {
  if (typeof window === "undefined") return;
  const currentSessionId = getSessionId();
  localStorage.removeItem("admin_session_id");
  localStorage.removeItem("admin_refresh_session_id");
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_refresh_token");
  localStorage.removeItem("admin_user");

  // Notify backend to revoke session and clear HTTP-only cookies
  fetch(`${apiBase}/auth/logout`, {
    method: "POST",
    headers: currentSessionId ? { "X-Session-Id": currentSessionId } : {},
    credentials: "include",
  }).catch(() => {});

  // Dispatch event for auth-context to clear React state
  window.dispatchEvent(new Event("admin:session-expired"));
}

async function refreshAdminSession(): Promise<string | null> {
  const refreshId = getRefreshSessionId();
  try {
    const res = await fetch(`${apiBase}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshSessionId: refreshId || "",
        refreshToken: refreshId || "",
      }),
      credentials: "include",
    });

    if (!res.ok) {
      clearAdminSession();
      return null;
    }

    const data = await res.json();
    const newSessionId = data.sessionId || data.accessToken;
    const newRefreshId = data.refreshSessionId || data.refreshToken;

    if (newSessionId && newRefreshId) {
      saveSessions(newSessionId, newRefreshId);
      return newSessionId;
    }

    clearAdminSession();
    return null;
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

  const sessionId = getSessionId();
  const headers = new Headers(init?.headers);

  if (sessionId) {
    headers.set("X-Session-Id", sessionId);
    headers.set("Authorization", `Session ${sessionId}`);
  }

  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers,
  });

  // If unauthorized (401 or 403) and not an auth endpoint, refresh session & retry
  if (
    (response.status === 401 || response.status === 403) &&
    !url.includes("/auth/")
  ) {
    // Deduplicate concurrent refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAdminSession().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const newSessionId = await (refreshPromise || refreshAdminSession());

    if (newSessionId) {
      // Retry the original request with new session ID
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set("X-Session-Id", newSessionId);
      retryHeaders.set("Authorization", `Session ${newSessionId}`);
      return fetch(url, {
        credentials: "include",
        ...init,
        headers: retryHeaders,
      });
    }

    // Refresh failed — session already cleared by refreshAdminSession
    return response;
  }

  return response;
}
