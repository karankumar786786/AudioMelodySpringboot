import { OneMelodyClient } from "@onemelody/api";

export * from "@onemelody/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export const adminClient = new OneMelodyClient({
  baseURL: API_BASE_URL,
  getToken: () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_token");
    }
    return null;
  },
  getRefreshToken: () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_refresh_token");
    }
    return null;
  },
  onTokenRefresh: (accessToken, refreshToken) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_token", accessToken);
      if (refreshToken) {
        localStorage.setItem("admin_refresh_token", refreshToken);
      }
    }
  },
  onAuthFailure: () => {
    if (typeof window !== "undefined") {
      console.warn("[adminClient] Token refresh failed. Purging session.");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_refresh_token");
      localStorage.removeItem("admin_user");
      window.location.href = "/";
    }
  },
});
