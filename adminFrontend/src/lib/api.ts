const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

export interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  songKey: string;
  imageKey: string;
  videoKey?: string;
  fullVideoKey?: string;
  language: string;
  lrclibId: string;
  isFeatured?: boolean;
  status?: string;
  createdAt?: string;
}

export interface Artist {
  id: string;
  name: string;
  about?: string;
  dob?: string;
  coverImageKey?: string;
  status?: string;
  createdAt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverImageKey?: string;
  videoKey?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  createdAt?: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  page: number;
  size: number;
  paginationMetaData?: {
    entityName?: string;
    totalCount?: number;
    activeCount?: number;
    blockedCount?: number;
    deletedCount?: number;
  };
}

export const adminClient = {
  auth: {
    login: async (email: string) => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password" }),
      });
      if (!res.ok) {
        let msg = "Login failed";
        try { const d = await res.json(); msg = d.message || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      return { data: { token: data.tempToken } };
    },
    register: async (name: string, email: string) => {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: name, email, password: "password" }),
      });
      if (!res.ok) {
        let msg = "Registration failed";
        try { const d = await res.json(); msg = d.message || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      return { data: { token: data.tempToken } };
    },
    verifyOtp: async (token: string, otp: string, email: string) => {
      // 1. Verify OTP with the real backend
      const verifyRes = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TEMP-TOKEN": token,
        },
        body: JSON.stringify({ otp }),
      });
      if (!verifyRes.ok) {
        let msg = "OTP verification failed";
        try { const d = await verifyRes.json(); msg = d.message || msg; } catch {}
        throw new Error(msg);
      }
      const verifyData = await verifyRes.json();
      const { accessToken, refreshToken } = verifyData;

      // 2. Fetch user profile with the real access token
      const profileRes = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      let user: any = { id: "unknown", email, name: "Admin", role: "admin" };
      if (profileRes.ok) {
        const profile = await profileRes.json();
        user = {
          id: profile.id,
          email: profile.email,
          name: profile.userName || profile.name || "Admin",
          role: profile.role || "user",
        };
      }

      return {
        data: {
          accessToken,
          refreshToken,
          user,
        },
      };
    },
    resendOtp: async (token: string, email: string) => {
      const res = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TEMP-TOKEN": token,
        },
      });
      if (!res.ok) {
        let msg = "Failed to resend OTP";
        try { const d = await res.json(); msg = d.message || msg; } catch {}
        throw new Error(msg);
      }
      // resend-otp returns void (200), keep using the same token
      return { data: { token } };
    },
  },
};
