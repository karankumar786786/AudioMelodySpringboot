import axios, { InternalAxiosRequestConfig } from "axios";
import { store } from "@/store/hook";
import { saveAuthToken, clearAuthToken } from "@/store/authSlice";
import { AuthStore } from "@/storage";
import { Device } from "@/storage/Device";

interface CustomRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
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
    return response;
  },
  async (error) => {
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