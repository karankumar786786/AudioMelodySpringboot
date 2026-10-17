export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

export function getStoredItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-device";
  }
  let deviceId = localStorage.getItem("melody_device_id");
  if (!deviceId) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = `dev_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    }
    localStorage.setItem("melody_device_id", deviceId);
  }
  return deviceId;
}

export function notifySessionCleared(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("session:cleared"));
  }
}

export function clearSessionStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("system_user");
  try {
    document.cookie =
      "system_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    document.cookie =
      "system_refresh_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch {}
  notifySessionCleared();
}

let isRefreshing = false;
let refreshTokenPromise: Promise<boolean> | null = null;

/**
 * Refreshes session cookies globally with the backend.
 * Cookies are managed automatically via Set-Cookie headers in the browser.
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshTokenPromise) {
    return refreshTokenPromise;
  }

  isRefreshing = true;
  refreshTokenPromise = (async () => {
    try {
      const deviceId = getDeviceId();
      const url = `${API_BASE_URL}/auth/refresh-token`;
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": deviceId,
          "Accept-Cookies": "true",
          "X-Accept-Cookies": "true",
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status === 400) {
          clearSessionStorage();
        }
        return false;
      }

      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshTokenPromise = null;
    }
  })();

  return refreshTokenPromise;
}

export async function request<T = any>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
  // Prevent any API fetch calls when offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const offlineErr = new Error("Device is offline");
    (offlineErr as any).isOffline = true;
    (offlineErr as any).status = 0;
    throw offlineErr;
  }

  const deviceId = getDeviceId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    ...(options.headers as Record<string, string>),
  };

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "include",
      ...options,
      headers,
    });
  } catch (err: any) {
    const error: any = new Error(err?.message || "Network request failed");
    error.isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    error.status = 0;
    throw error;
  }

  if (!response.ok) {
    const isAuthFailure = response.status === 401 || response.status === 403;
    const isAuthEndpoint = endpoint.includes("/auth/");

    if (isAuthFailure && retry && !isAuthEndpoint) {
      try {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry request with updated cookies
          return await request<T>(endpoint, options, false);
        }
      } catch {}
    }

    if (isAuthFailure && !isAuthEndpoint) {
      clearSessionStorage();
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path !== "/signup" && path !== "/login" && path !== "/") {
          window.location.replace("/signup?session_expired=1");
        }
      }
    }

    let errMessage = `HTTP error ${response.status}`;
    let errData: any = null;
    try {
      errData = await response.json();
      errMessage = errData.message || errMessage;
    } catch {}
    const error: any = new Error(errMessage);
    error.response = {
      status: response.status,
      data: errData,
    };
    throw error;
  }

  if (response.status === 204) {
    return {} as T;
  }

  // Safely parse JSON — some endpoints return 200 with empty body
  const text = await response.text();
  if (!text || !text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export function formatPaginated<T>(res: any) {
  const content = res.content || (Array.isArray(res) ? res : res.data || []);
  const page = res.page !== undefined ? res.page : 0;
  const size = res.size !== undefined ? res.size : content.length;
  const total = res.paginationMetaData?.activeCount || res.paginationMetaData?.totalCount || content.length;

  return {
    data: {
      data: content as T[],
      pagination: {
        page: page + 1,
        limit: size,
        total,
        hasNext: content.length >= size && (page + 1) * size < total,
      },
    },
  };
}
