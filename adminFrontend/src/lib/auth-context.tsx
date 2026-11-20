"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { adminClient } from "./api";
import {
  ADMIN_USER_KEY,
  clearLegacyAdminTokens,
  refreshAdminSession,
  withAdminHeaders,
} from "./adminFetch";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string) => Promise<{ success: boolean; token: string; message?: string }>;
  register: (name: string, email: string) => Promise<{ success: boolean; token: string; message?: string }>;
  verifyOtp: (email: string, otp: string, token: string) => Promise<{ success: boolean; message?: string }>;
  resendOtp: (email: string, token: string) => Promise<{ success: boolean; token?: string; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Clears cached client state. The session itself lives in HttpOnly cookies. */
function clearStorage() {
  if (typeof window === "undefined") return;
  clearLegacyAdminTokens();
  localStorage.removeItem(ADMIN_USER_KEY);
}

function toUser(profile: any): User {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.userName || profile.name || "Admin",
    role: profile.role || "user",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Cached admin data belongs to the signed-in session; drop it when the session ends.
  const queryClient = useQueryClient();

  useEffect(() => {
    // Session IDs from older builds are no longer kept in localStorage; the backend's
    // HttpOnly cookies (already set at login) carry the session.
    clearLegacyAdminTokens();

    const goToLogin = () => {
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        router.push("/");
      }
    };

    const savedUser = localStorage.getItem(ADMIN_USER_KEY);
    if (!savedUser) {
      goToLogin();
      setLoading(false);
      return;
    }

    try {
      setUser(JSON.parse(savedUser));
    } catch (err) {
      console.error("Failed to parse admin_user", err);
      clearStorage();
      goToLogin();
      setLoading(false);
      return;
    }

    // Validate the cookie session against the backend, refreshing it once if needed
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const fetchProfile = () =>
      fetch(`${apiBase}/api/user/profile`, {
        headers: withAdminHeaders(),
        credentials: "include",
      });

    const expire = (reason: string) => {
      console.warn(`[Admin Auth] ${reason} Clearing session.`);
      clearStorage();
      setUser(null);
      goToLogin();
    };

    (async () => {
      try {
        let res = await fetchProfile();
        if (!res.ok) {
          if (!(await refreshAdminSession())) {
            expire("Session refresh failed.");
            return;
          }
          res = await fetchProfile();
          if (!res.ok) {
            expire("Session refresh succeeded but profile fetch failed.");
            return;
          }
        }
        const updatedUser = toUser(await res.json());
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(updatedUser));
        setUser(updatedUser);
      } catch {
        // Network error — keep the cached profile
      }
    })();

    setLoading(false);
  }, [router]);

  // Listen for session-expired events from adminFetch
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn("[Admin Auth] Session expired event received. Redirecting to login.");
      clearStorage();
      queryClient.clear();
      setUser(null);
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        router.push("/");
      }
    };
    window.addEventListener("admin:session-expired", handleSessionExpired);
    return () => window.removeEventListener("admin:session-expired", handleSessionExpired);
  }, [router, queryClient]);

  const login = async (email: string) => {
    try {
      clearStorage();
      const res = await adminClient.auth.login(email);
      return { success: true, token: res.data.token };
    } catch (err: any) {
      throw new Error(err.message || "Failed to log in");
    }
  };

  const register = async (name: string, email: string) => {
    try {
      clearStorage();
      const res = await adminClient.auth.register(name, email);
      return { success: true, token: res.data.token };
    } catch (err: any) {
      throw new Error(err.message || "Failed to register");
    }
  };

  const verifyOtp = async (email: string, otp: string, emailToken: string) => {
    try {
      const res = await adminClient.auth.verifyOtp(emailToken, otp, email);
      const { user: userData } = res.data;
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch (err: any) {
      throw new Error(err.message || "Failed to verify OTP");
    }
  };

  const resendOtp = async (email: string, emailToken: string) => {
    try {
      const res = await adminClient.auth.resendOtp(emailToken, email);
      return { success: true, token: res.data.token };
    } catch (err: any) {
      throw new Error(err.message || "Failed to resend OTP");
    }
  };

  const logout = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    // Revokes the session and clears the HttpOnly cookies server-side
    fetch(`${apiBase}/auth/logout`, {
      method: "POST",
      headers: withAdminHeaders(),
      credentials: "include",
    }).catch(() => {});
    clearStorage();
    queryClient.clear();
    setUser(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        verifyOtp,
        resendOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
