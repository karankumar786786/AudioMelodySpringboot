import {
  clearSessionStorage,
  getDeviceId,
  request,
} from "./client";

export const authApi = {
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

    // Cookies are automatically set in the browser via backend Set-Cookie headers.
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
      await request("/auth/logout", {
        method: "POST",
        headers: {
          "Accept-Cookies": "true",
          "X-Accept-Cookies": "true",
        },
        body: JSON.stringify({ deviceId }),
      });
    } catch {
      // Silently handle logout failure on network error
    } finally {
      clearSessionStorage();
    }
  },
};
