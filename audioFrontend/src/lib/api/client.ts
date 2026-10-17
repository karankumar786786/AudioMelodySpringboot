import { saveAuthCookies, clearAuthCookies, getCookie } from "@/lib/cookies";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

export function getStoredItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  const localVal = localStorage.getItem(key);
  if (localVal) return localVal;
  const cookieVal = getCookie(key);
  if (cookieVal) {
    try {
      localStorage.setItem(key, cookieVal);
    } catch {}
    return cookieVal;
  }
  return null;
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

export function saveSessionTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("system_token", accessToken);
  localStorage.setItem("system_refresh_token", refreshToken);
  saveAuthCookies({ accessToken, refreshToken });
  import("@/store/player.store")
    .then(({ playerStore }) => {
      playerStore.setState((s) => ({
        ...s,
        systemToken: accessToken,
        systemRefreshToken: refreshToken,
      }));
    })
    .catch(() => {});
}

export function notifySessionCleared(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("session:cleared"));
  }
}

export function clearSessionStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("system_token");
  localStorage.removeItem("system_refresh_token");
  localStorage.removeItem("system_user");
  clearAuthCookies();
  notifySessionCleared();
}

let isRefreshing = false;
let refreshTokenPromise: Promise<string> | null = null;

export async function refreshAccessToken(): Promise<string> {
  // If a refresh is already in progress, wait for the pending refresh promise
  if (isRefreshing && refreshTokenPromise) {
    return refreshTokenPromise;
  }

  isRefreshing = true;
  refreshTokenPromise = (async () => {
    try {
      const refreshToken = getStoredItem("system_refresh_token");
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

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
        body: JSON.stringify({ refreshToken, deviceId }),
      });

      if (!response.ok) {
        // Only purge session if the refresh token is explicitly rejected as unauthorized/invalid
        if (response.status === 401 || response.status === 403 || response.status === 400) {
          clearSessionStorage();
        }
        let errMessage = `HTTP error ${response.status}`;
        try {
          const errData = await response.json();
          errMessage = errData.message || errMessage;
        } catch {}
        const error: any = new Error(errMessage);
        error.response = { status: response.status };
        throw error;
      }

      const data = await response.json();
      if (!data.accessToken || !data.refreshToken) {
        clearSessionStorage();
        throw new Error("Invalid refresh token response");
      }

      saveSessionTokens(data.accessToken, data.refreshToken);
      return data.accessToken as string;
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

  const token = getStoredItem("system_token");
  const deviceId = getDeviceId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

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
    const storedRefreshToken = getStoredItem("system_refresh_token");

    if (isAuthFailure && retry && !isAuthEndpoint && storedRefreshToken) {
      try {
        const refreshedToken = await refreshAccessToken();
        headers["Authorization"] = `Bearer ${refreshedToken}`;

        // Retry request with updated auth header and retry set to false
        return await request<T>(endpoint, { ...options, headers }, false);
      } catch (err) {
        throw err;
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
