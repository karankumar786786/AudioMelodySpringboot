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

export const tokenStorage = {
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("system_token");
  },
  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("system_refresh_token");
  },
  setTokens: (accessToken: string, refreshToken?: string): void => {
    if (typeof window === "undefined") return;
    if (accessToken) {
      localStorage.setItem("system_token", accessToken);
    }
    if (refreshToken) {
      localStorage.setItem("system_refresh_token", refreshToken);
    }
  },
  clearTokens: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("system_token");
    localStorage.removeItem("system_refresh_token");
    localStorage.removeItem("system_user");
    notifySessionCleared();
  },
};

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
 * Automatically configured with JWT Bearer token authentication,
 * base URL, and request/response interceptors.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: Offline guard + Bearer Token injection
apiClient.interceptors.request.use((config) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const offlineErr = new Error("Device is offline");
    (offlineErr as any).isOffline = true;
    (offlineErr as any).status = 0;
    return Promise.reject(offlineErr);
  }

  const token = tokenStorage.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

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

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };
    const status = error.response?.status;
    const isAuthFailure = status === 401 || status === 403;
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/");

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
          .then(() => {
            if (originalRequest.headers) {
              const freshToken = tokenStorage.getAccessToken();
              if (freshToken) {
                originalRequest.headers.Authorization = `Bearer ${freshToken}`;
              }
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          processQueue(null, true);
          if (originalRequest.headers) {
            const freshToken = tokenStorage.getAccessToken();
            if (freshToken) {
              originalRequest.headers.Authorization = `Bearer ${freshToken}`;
            }
          }
          return apiClient(originalRequest);
        }
        processQueue(error, false);
        tokenStorage.clearTokens();
        redirectToLogin();
        return Promise.reject(error);
      } catch (refreshErr) {
        processQueue(refreshErr, false);
        tokenStorage.clearTokens();
        redirectToLogin();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Refreshes JWT tokens globally with the backend via Axios.
 * Uses refresh token and device ID from localStorage and persists renewed tokens.
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = tokenStorage.getRefreshToken();
    const deviceId = getDeviceId();
    if (!refreshToken || !deviceId) {
      tokenStorage.clearTokens();
      return false;
    }

    const res = await axios.post(
      `${API_BASE_URL}/auth/refresh-token`,
      { refreshToken, deviceId },
      { timeout: 10000 },
    );

    if (res.data?.accessToken) {
      tokenStorage.setTokens(res.data.accessToken, res.data.refreshToken);
      return true;
    }
    tokenStorage.clearTokens();
    return false;
  } catch (err: any) {
    if (
      err.response?.status === 401 ||
      err.response?.status === 403 ||
      err.response?.status === 400
    ) {
      tokenStorage.clearTokens();
    }
    return false;
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
