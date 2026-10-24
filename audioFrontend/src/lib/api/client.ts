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
  try {
    if (!document.cookie.includes("melody_device_id=")) {
      document.cookie = `melody_device_id=${encodeURIComponent(deviceId)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  } catch {}
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
  notifySessionCleared();
}

/**
 * Centralized Axios client instance.
 * Automatically configured with credentials (for cookie session management),
 * base URL, and request/response interceptors.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Offline guard request interceptor
apiClient.interceptors.request.use((config) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const offlineErr = new Error("Device is offline");
    (offlineErr as any).isOffline = true;
    (offlineErr as any).status = 0;
    return Promise.reject(offlineErr);
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
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          processQueue(null, true);
          return apiClient(originalRequest);
        }
        processQueue(error, false);
        clearSessionStorage();
        redirectToLogin();
        return Promise.reject(error);
      } catch (refreshErr) {
        processQueue(refreshErr, false);
        clearSessionStorage();
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
 * Refreshes session cookies globally with the backend via Axios.
 * Browser automatically carries the `system_refresh_token` cookie and receives new cookies.
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const deviceId = getDeviceId();
    await axios.post(
      `${API_BASE_URL}/auth/refresh-token`,
      { deviceId },
      { withCredentials: true, timeout: 10000 },
    );
    return true;
  } catch (err: any) {
    if (
      err.response?.status === 401 ||
      err.response?.status === 403 ||
      err.response?.status === 400
    ) {
      clearSessionStorage();
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
