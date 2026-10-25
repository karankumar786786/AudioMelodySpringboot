import axios, { InternalAxiosRequestConfig } from "axios";
import { store } from "@/store/hook";
import { saveAuthToken, clearAuthToken } from "@/store/authSlice";

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
    const accessToken = store.getState().auth.accessToken;
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

      const refreshToken = store.getState().auth.refreshToken;
      if (!refreshToken) {
        await store.dispatch(clearAuthToken());
        return Promise.reject(error);
      }

      // Handle concurrent requests by sharing a single refresh promise
      if (!refreshTokenPromise) {
        refreshTokenPromise = (async () => {
          try {
            const authBaseUrl = (api.defaults.baseURL || "http://localhost:8080").replace(/\/api\/?$/, "");
            const deviceId = store.getState().device.deviceId;
            const res = await axios.post<{
              accessToken: string;
              refreshToken?: string;
            }>(`${authBaseUrl}/auth/refresh-token`, { refreshToken, deviceId });

            if (res.data?.accessToken) {
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
              await store.dispatch(clearAuthToken());
              return null;
            }
          } catch (refreshError) {
            await store.dispatch(clearAuthToken());
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