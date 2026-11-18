import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

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
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = `dev_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    }
    localStorage.setItem("melody_device_id", deviceId);
  }
  return deviceId;
}

/**
 * Auth tokens live in HttpOnly cookies set by the API (melody_access / melody_refresh);
 * scripts never see them. This header opts requests into cookie auth on the API and,
 * being a custom header, forces a CORS preflight (CSRF protection).
 */
export const WEB_CLIENT_HEADERS = { "X-Melody-Client": "web" } as const;

/** Keys that used to hold JWTs in localStorage. Removed on load; never written again. */
const LEGACY_TOKEN_KEYS = ["system_token", "system_refresh_token"] as const;
const USER_KEY = "system_user";

export const sessionStorageKeys = { USER_KEY };

export const tokenStorage = {
  /**
   * Whether this browser believes it is signed in. The cached (non-secret) profile is the
   * marker, since the cookies are not readable; the API is still the source of truth.
   */
  hasSession: (): boolean => {
    if (typeof window === "undefined") return false;
    return Boolean(localStorage.getItem(USER_KEY));
  },
  clearTokens: (): void => {
    if (typeof window === "undefined") return;
    for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
    localStorage.removeItem(USER_KEY);
    notifySessionCleared();
  },
};

let legacyMigration: Promise<void> | null = null;

/**
 * One-time upgrade for browsers that signed in before cookie auth: trade the legacy
 * localStorage refresh token for HttpOnly cookies, then delete the legacy keys.
 * Safe to call repeatedly; runs at most once per page load.
 */
export function migrateLegacyTokens(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (legacyMigration) return legacyMigration;
  legacyMigration = (async () => {
    const legacyRefresh = localStorage.getItem("system_refresh_token");
    for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
    if (!legacyRefresh || !localStorage.getItem(USER_KEY)) return;
    try {
      await axios.post(
        `${API_BASE_URL}/auth/refresh-token`,
        { refreshToken: legacyRefresh, deviceId: getDeviceId() },
        {
          timeout: 15000,
          withCredentials: true,
          headers: { "Content-Type": "application/json", ...WEB_CLIENT_HEADERS },
        },
      );
    } catch {
      // Expired or revoked: the next API call gets a 401 and the normal flow logs the user out.
    }
  })();
  return legacyMigration;
}

export function notifySessionCleared(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("session:cleared"));
  }
}

export function clearSessionStorage(): void {
  tokenStorage.clearTokens();
}

/**
 * Centralized Axios client instance.
 * Authenticates with the API's HttpOnly cookies (withCredentials) and handles
 * base URL plus request/response interceptors.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    ...WEB_CLIENT_HEADERS,
  },
});

// Request interceptor: Offline guard (+ finish any legacy token migration first)
apiClient.interceptors.request.use(async (config) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const offlineErr = new Error("Device is offline");
    (offlineErr as any).isOffline = true;
    (offlineErr as any).status = 0;
    return Promise.reject(offlineErr);
  }

  await migrateLegacyTokens();
  return config;
});

// Automatic 401 token refresh queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, success = false) => {
  failedQueue.forEach((prom) => {
    if (success) {
      prom.resolve();
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path !== "/signup" && path !== "/login" && path !== "/") {
      window.location.replace("/signup?session_expired=1");
    }
  }
}

export interface RefreshResult {
  success: boolean;
  isAuthError: boolean;
  isNetworkError: boolean;
  error?: any;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };
    const status = error.response?.status;
    // Only refresh on 401 Unauthorized (never on 403 Forbidden, which is a permission error)
    const isAuthFailure = status === 401;
    const isAuthEndpoint =
      originalRequest?.url?.includes("/auth/") ||
      originalRequest?.url?.includes("/api/user/sessions/logout");

    if (
      isAuthFailure &&
      !isAuthEndpoint &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResult = await refreshAccessToken();
        if (refreshResult.success) {
          processQueue(null, true);
          return apiClient(originalRequest);
        }

        // ONLY clear tokens and redirect to login if the auth server explicitly rejected credentials
        if (refreshResult.isAuthError) {
          processQueue(error, false);
          tokenStorage.clearTokens();
          redirectToLogin();
          return Promise.reject(error);
        }

        // On transient network errors, socket drops, or timeouts:
        // DO NOT log the user out! Keep the session and reject with the network error.
        processQueue(refreshResult.error || error, false);
        return Promise.reject(refreshResult.error || error);
      } catch (refreshErr) {
        processQueue(refreshErr, false);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Refreshes the session with the backend. The refresh token travels as an HttpOnly
 * cookie and the API rotates both cookies in its response.
 * Handles transient network errors gracefully without purging the session.
 */
export async function refreshAccessToken(): Promise<RefreshResult> {
  try {
    await migrateLegacyTokens();
    const deviceId = getDeviceId();

    // Fast check: if device is completely offline, do not attempt or purge
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { success: false, isAuthError: false, isNetworkError: true };
    }

    // Retry once for transient glitches (e.g. WiFi handshake latency)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          { deviceId },
          {
            timeout: 15000,
            withCredentials: true,
            headers: { "Content-Type": "application/json", ...WEB_CLIENT_HEADERS },
          },
        );
        return { success: true, isAuthError: false, isNetworkError: false };
      } catch (err: any) {
        const status = err.response?.status;
        const isExplicitAuthFailure =
          status === 401 ||
          status === 403 ||
          (status === 400 &&
            err.response?.data?.message?.toLowerCase().includes("token"));

        if (isExplicitAuthFailure) {
          // Genuine invalid/expired refresh token from backend
          tokenStorage.clearTokens();
          return {
            success: false,
            isAuthError: true,
            isNetworkError: false,
            error: err,
          };
        }

        // Connection reset, timeout, or DNS/network issue
        const isNetwork =
          !err.response ||
          err.code === "ECONNABORTED" ||
          err.code === "ERR_NETWORK" ||
          err.message?.includes("Network Error") ||
          err.message?.includes("timeout");

        if (attempt === 1 && isNetwork) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }

        // Return network error without wiping the session!
        return {
          success: false,
          isAuthError: false,
          isNetworkError: true,
          error: err,
        };
      }
    }

    return { success: false, isAuthError: false, isNetworkError: true };
  } catch (err: any) {
    return {
      success: false,
      isAuthError: false,
      isNetworkError: true,
      error: err,
    };
  }
}

/**
 * Universal request wrapper powered by the Axios client.
 * Normalizes input options and returns unwrapped response body data.
 */
export async function request<T = any>(
  endpoint: string,
  options: any = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  let data = options.data;
  if (!data && options.body) {
    if (typeof options.body === "string") {
      try {
        data = JSON.parse(options.body);
      } catch {
        data = options.body;
      }
    } else {
      data = options.body;
    }
  }

  const response = await apiClient.request<T>({
    url: endpoint,
    method,
    data,
    headers: options.headers,
    params: options.params,
  });

  return (response.data !== undefined ? response.data : {}) as T;
}

export function formatPaginated<T>(res: any) {
  const content = res.content || (Array.isArray(res) ? res : res.data || []);
  const page = res.page !== undefined ? res.page : 0;
  const size = res.size !== undefined ? res.size : content.length;
  const total =
    res.paginationMetaData?.activeCount ||
    res.paginationMetaData?.totalCount ||
    content.length;

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
