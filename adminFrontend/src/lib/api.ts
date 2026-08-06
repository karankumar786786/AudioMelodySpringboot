const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

export interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  songKey: string;
  imageKey: string;
  language: string;
  lrclibId: string;
  status?: string;
  createdAt?: string;
}

export interface Artist {
  id: string;
  name: string;
  about?: string;
  dob?: string;
  coverImageKey?: string;
  bannerImageKey?: string;
  status?: string;
  createdAt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverImageKey?: string;
  bannerImageKey?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "superadmin";
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
      if (!res.ok) throw new Error("Login failed");
      const data = await res.json();
      return { data: { token: data.accessToken || "token" } };
    },
    register: async (name: string, email: string) => {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: "password" }),
      });
      if (!res.ok) throw new Error("Registration failed");
      const data = await res.json();
      return { data: { token: data.accessToken || "token" } };
    },
    verifyOtp: async (token: string, otp: string, email: string) => {
      return {
        data: {
          accessToken: token || "mock-access-token",
          refreshToken: "mock-refresh-token",
          user: { id: "admin1", email, name: "Admin", role: "superadmin" as const },
        },
      };
    },
    resendOtp: async (token: string, email: string) => {
      return { data: { token: token || "mock-token" } };
    },
  },
};
