import axios, { InternalAxiosRequestConfig } from "axios";
import { store } from "@/store/hook";
import { saveAuthToken, clearAuthToken } from "@/store/authSlice";
import { AuthStore } from "@/storage";
import { Device } from "@/storage/Device";
import { isOnline, reportRequestFailure, reportRequestSuccess } from "./network";

interface CustomRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _networkRetryCount?: number;
}

// --- Retry with backoff for idempotent reads ----------------------------------
const MAX_NETWORK_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 400;

// Never auto-retry anything auth or OTP related (refresh, login, verify/resend OTP...).
const NO_RETRY_PATTERN = /\/auth\/|otp/i;

function isRetryableFailure(error: any): "network" | "server" | null {
  if (axios.isCancel(error) || error?.code === "ERR_CANCELED") return null;
  const status: number | undefined = error?.response?.status;
  if (!error?.response) return "network"; // timeout, DNS, connection dropped
  if (typeof status === "number" && status >= 500) return "server";
  return null;
}

function canRetry(config: CustomRequestConfig | undefined): config is CustomRequestConfig {
  if (!config) return false;
  if ((config.method ?? "get").toLowerCase() !== "get") return false;
  if (config.url && NO_RETRY_PATTERN.test(config.url)) return false;
  return true;
}

function backoffDelay(attempt: number): number {
  const exp = BASE_RETRY_DELAY_MS * 2 ** attempt;
  return exp + Math.floor(Math.random() * BASE_RETRY_DELAY_MS);
}

/**
 * Retries GETs on network errors and 5xx with exponential backoff.
 * Returns the retried response, or null when the error should fall through.
 */
async function retryIdempotentRequest(error: any) {
  const config = error?.config as CustomRequestConfig | undefined;
  const kind = isRetryableFailure(error);
  if (!kind) return null;
  if (!canRetry(config)) {
    reportRequestFailure(kind);
    return null;
  }

  const attempt = config._networkRetryCount ?? 0;
  // No point hammering the network while the device is offline; React Query
  // refetches once the connection is back.
  if (attempt >= MAX_NETWORK_RETRIES || !isOnline()) {
    reportRequestFailure(kind);
    return null;
  }

  config._networkRetryCount = attempt + 1;
  await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)));
  return api(config);
}

/** A short, user-facing explanation for a failed request. */
export function getRequestErrorMessage(error: unknown): string {
  const e = error as any;
  if (!isOnline()) return "You're offline. Connect to the internet and try again.";
  if (!e?.response) return "Can't reach One Melody. Check your connection and try again.";
  const status: number = e.response.status;
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  const serverMessage = e.response.data?.message;
  if (typeof serverMessage === "string" && serverMessage.trim()) return serverMessage;
  return "That didn't work. Please try again.";
}

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.105:9090/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    let accessToken: string | undefined;
    try {
      accessToken = store?.getState?.()?.auth?.accessToken;
    } catch {}

    if (!accessToken) {
      try {
        const tokenObj = await AuthStore.getAuthTokenFromSecureStorage();
        accessToken = tokenObj?.accessToken;
      } catch {}
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let refreshTokenPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => {
    reportRequestSuccess();
    return response;
  },
  async (error) => {
    const retried = await retryIdempotentRequest(error);
    if (retried) return retried;

    const originalRequest = error.config as CustomRequestConfig | undefined;

    if (
      (error.response?.status === 403 || error.response?.status === 401) &&
      originalRequest &&
      !originalRequest._retry
    ) {
      // Avoid looping if the refresh or login request itself failed
      if (
        originalRequest.url?.includes("/auth/refresh") ||
        originalRequest.url?.includes("/auth/login")
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // 1. Get refreshToken with fallback to SecureStore
      let refreshToken = store.getState().auth.refreshToken;
      if (!refreshToken) {
        try {
          const stored = await AuthStore.getAuthTokenFromSecureStorage();
          refreshToken = stored?.refreshToken;
        } catch {}
      }

      if (!refreshToken) {
        await store.dispatch(clearAuthToken());
        return Promise.reject(error);
      }

      // 2. Handle concurrent requests by sharing a single refresh promise
      if (!refreshTokenPromise) {
        refreshTokenPromise = (async () => {
          try {
            const authBaseUrl = (api.defaults.baseURL || "http://localhost:8080").replace(/\/api\/?$/, "");

            let deviceId = store.getState().device.deviceId;
            if (!deviceId) {
              try {
                deviceId = await Device.getId();
              } catch {}
            }

            if (!deviceId) {
              console.warn("[baseApi] No device ID available for refresh token");
              return null;
            }

            // Retry up to 2 times for transient network drops (e.g. WiFi reconnect on phone wake)
            let res: any = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                res = await axios.post<{
                  accessToken: string;
                  refreshToken?: string;
                }>(
                  `${authBaseUrl}/auth/refresh-token`,
                  { refreshToken, deviceId },
                  { timeout: 15000 }
                );
                break;
              } catch (postErr: any) {
                const status = postErr.response?.status;
                // If it's an explicit 401 or 403, stop retrying immediately
                if (status === 401 || status === 403) {
                  throw postErr;
                }
                if (attempt === 1) {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                } else {
                  throw postErr;
                }
              }
            }

            if (res?.data?.accessToken) {
              const newAccessToken = res.data.accessToken;
              const newRefreshToken = res.data.refreshToken || refreshToken;

              await store.dispatch(
                saveAuthToken({
                  accessToken: newAccessToken,
                  refreshToken: newRefreshToken,
                })
              );

              return newAccessToken;
            } else {
              return null;
            }
          } catch (refreshError: any) {
            const status = refreshError.response?.status;
            // ONLY log the user out if the server explicitly confirmed the session/token is invalid or revoked (401 or 403)
            // DO NOT clear auth tokens on transient network drops, timeouts, or 500 errors!
            if (status === 401 || status === 403) {
              console.warn("[baseApi] Refresh token rejected by server (401/403). Clearing auth session.");
              await store.dispatch(clearAuthToken());
            } else {
              console.warn("[baseApi] Transient network/server error during refresh. Retaining tokens.", refreshError?.message);
            }
            return null;
          } finally {
            refreshTokenPromise = null;
          }
        })();
      }

      try {
        const newAccessToken = await refreshTokenPromise;
        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);