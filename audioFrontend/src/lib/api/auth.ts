import {
  clearSessionStorage,
  getDeviceId,
  request,
  tokenStorage,
} from "./client";
import type { SessionStatus, User } from "./types";

export const authApi = {
  getProfile: async () => {
    return await request<User>("/api/user/profile");
  },
  getSessionStatus: async () => {
    return await request<SessionStatus>("/api/user/sessions/status");
  },
  login: async (email: string) => {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return { data: { token: data.tempToken } };
  },
  register: async (name: string, email: string) => {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ userName: name, email }),
    });
    return { data: { token: data.tempToken } };
  },
  resendOtp: async (token: string) => {
    const data = await request<{ tempToken?: string }>("/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ tempToken: token }),
    });
    return { data: { token: data?.tempToken || token } };
  },
  verifyOtp: async (token: string, code: string) => {
    const deviceId = getDeviceId();
    const verifyRes = await request("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ tempToken: token, otp: code, deviceId }),
    });

    // Store JWT tokens securely in localStorage
    if (verifyRes?.accessToken) {
      tokenStorage.setTokens(verifyRes.accessToken, verifyRes.refreshToken);
    }

    // Fetch profile and store user identity for client-side state
    const profile = await request("/api/user/profile");
    const userPayload = {
      ...profile,
      name: profile.userName || "User",
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("system_user", JSON.stringify(userPayload));
    }

    try {
      const { playerStore } = await import("@/store/player.store");
      playerStore.setState((s) => ({
        ...s,
        systemUser: userPayload,
      }));
    } catch {}

    return {
      data: {
        isNewUser: Boolean(verifyRes?.isNewUser),
        user: userPayload,
      },
    };
  },
  logout: async (allDevices = false) => {
    try {
      const deviceId = getDeviceId();
      const refreshToken = tokenStorage.getRefreshToken() || undefined;
      await request("/api/user/sessions/logout", {
        method: "POST",
        body: JSON.stringify({ deviceId, refreshToken, allDevices }),
      });
    } catch {
      // Silently handle logout failure on network error
    } finally {
      clearSessionStorage();
    }
  },
};
