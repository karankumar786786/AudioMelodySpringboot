import {
  clearSessionStorage,
  getDeviceId,
  getStoredRefreshToken,
  request,
  syncTokens,
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
      headers: {
        "X-TEMP-TOKEN": token,
        "X-Device-Id": deviceId,
        "Accept-Cookies": "true",
        "X-Accept-Cookies": "true",
      },
      body: JSON.stringify({ otp: code, deviceId }),
    });

    if (verifyRes?.accessToken) {
      syncTokens(verifyRes.accessToken, verifyRes.refreshToken);
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
  logout: async () => {
    try {
      const deviceId = getDeviceId();
      const refreshToken = getStoredRefreshToken();
      await request("/auth/logout", {
        method: "POST",
        headers: {
          "Accept-Cookies": "true",
          "X-Accept-Cookies": "true",
          ...(refreshToken ? { "X-Refresh-Token": refreshToken } : {}),
        },
        body: JSON.stringify({ deviceId, refreshToken }),
      });
    } catch {
      // Silently handle logout failure on network error
    } finally {
      clearSessionStorage();
    }
  },
};
