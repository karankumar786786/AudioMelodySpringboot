import { saveAuthCookies } from "@/lib/cookies";
import {
  clearSessionStorage,
  getDeviceId,
  getStoredItem,
  request,
  saveSessionTokens,
} from "./client";

export const authApi = {
  login: async (email: string) => {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "password" }),
    });
    return { data: { token: data.tempToken } };
  },
  register: async (name: string, email: string) => {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ userName: name, email, password: "password" }),
    });
    return { data: { token: data.tempToken } };
  },
  resendOtp: async (token: string) => {
    await request("/auth/resend-otp", {
      method: "POST",
      headers: { "X-TEMP-TOKEN": token },
    });
    return { data: { token } };
  },
  verifyOtp: async (token: string, code: string) => {
    const deviceId = getDeviceId();
    const verifyRes = await request("/auth/verify-otp", {
      method: "POST",
      headers: { "X-TEMP-TOKEN": token, "X-Device-Id": deviceId },
      body: JSON.stringify({ otp: code, deviceId }),
    });

    const { accessToken, refreshToken } = verifyRes;

    if (accessToken && refreshToken) {
      saveSessionTokens(accessToken, refreshToken);
    } else if (accessToken && typeof window !== "undefined") {
      localStorage.setItem("system_token", accessToken);
      saveAuthCookies({ accessToken });
    }

    const profile = await request("/api/user/profile");
    const userPayload = {
      ...profile,
      name: profile.userName || "User",
    };

    saveAuthCookies({
      accessToken: accessToken || "",
      refreshToken: refreshToken || null,
      user: userPayload,
    });

    return {
      data: {
        accessToken,
        refreshToken,
        isNewUser: Boolean(verifyRes?.isNewUser),
        user: userPayload,
      },
    };
  },
  logout: async () => {
    try {
      const deviceId = getDeviceId();
      const refreshToken = getStoredItem("system_refresh_token");
      await request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ deviceId, refreshToken }),
      });
    } catch {
      // Silently handle logout failure on network error
    } finally {
      clearSessionStorage();
    }
  },
};
