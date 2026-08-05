import { OneMelodyClient } from "@onemelody/api";

export * from "@onemelody/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001/api/v1";

export const client = new OneMelodyClient({
  baseURL: API_BASE_URL,
  getToken: () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("system_token");
    }
    return null;
  },
  getRefreshToken: () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("system_refresh_token");
    }
    return null;
  },
  onTokenRefresh: (accessToken, refreshToken) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("system_token", accessToken);
      if (refreshToken) {
        localStorage.setItem("system_refresh_token", refreshToken);
      }
    }
  },
  onAuthFailure: () => {
    if (typeof window !== "undefined") {
      console.warn("[API] Token refresh failed. Purging session.");
      localStorage.removeItem("system_token");
      localStorage.removeItem("system_refresh_token");
      localStorage.removeItem("system_user");
      window.location.reload();
    }
  },
});

// Backward-compatible exports
export const api = client.api;
export const musicApi = client;
