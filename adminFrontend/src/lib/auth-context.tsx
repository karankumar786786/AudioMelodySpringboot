"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminClient } from "./api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string) => Promise<{ success: boolean; token: string; message?: string }>;
  register: (name: string, email: string) => Promise<{ success: boolean; token: string; message?: string }>;
  verifyOtp: (email: string, otp: string, token: string) => Promise<{ success: boolean; message?: string }>;
  resendOtp: (email: string, token: string) => Promise<{ success: boolean; token?: string; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Hydrate session from localStorage and validate the token
    const savedUser = localStorage.getItem("admin_user");
    const savedToken = localStorage.getItem("admin_token");
    if (savedUser && savedToken) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setToken(savedToken);

        // Validate the token against the backend
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";
        fetch(`${apiBase}/api/user/profile`, {
          headers: { "Authorization": `Bearer ${savedToken}` },
        }).then(async (res) => {
          if (!res.ok) {
            // Token is invalid or expired — try refreshing
            const refreshToken = localStorage.getItem("admin_refresh_token");
            if (refreshToken) {
              try {
                const refreshRes = await fetch(`${apiBase}/auth/refresh-token`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ refreshToken }),
                });
                if (refreshRes.ok) {
                  const refreshData = await refreshRes.json();
                  localStorage.setItem("admin_token", refreshData.accessToken);
                  localStorage.setItem("admin_refresh_token", refreshData.refreshToken);
                  setToken(refreshData.accessToken);
                  // Re-fetch profile with new token
                  const profileRes = await fetch(`${apiBase}/api/user/profile`, {
                    headers: { "Authorization": `Bearer ${refreshData.accessToken}` },
                  });
                  if (profileRes.ok) {
                    const profile = await profileRes.json();
                    const updatedUser = {
                      id: profile.id,
                      email: profile.email,
                      name: profile.userName || profile.name || "Admin",
                      role: profile.role || "user",
                    };
                    localStorage.setItem("admin_user", JSON.stringify(updatedUser));
                    setUser(updatedUser as User);
                  } else {
                    // Still failing — clear session
                    console.warn("[Admin Auth] Token refresh succeeded but profile fetch failed. Clearing session.");
                    localStorage.removeItem("admin_token");
                    localStorage.removeItem("admin_refresh_token");
                    localStorage.removeItem("admin_user");
                    setUser(null);
                    setToken(null);
                  }
                } else {
                  // Refresh failed — clear session
                  console.warn("[Admin Auth] Token refresh failed. Clearing stale session.");
                  localStorage.removeItem("admin_token");
                  localStorage.removeItem("admin_refresh_token");
                  localStorage.removeItem("admin_user");
                  setUser(null);
                  setToken(null);
                }
              } catch {
                localStorage.removeItem("admin_token");
                localStorage.removeItem("admin_refresh_token");
                localStorage.removeItem("admin_user");
                setUser(null);
                setToken(null);
              }
            } else {
              // No refresh token — clear session
              console.warn("[Admin Auth] No refresh token available. Clearing stale session.");
              localStorage.removeItem("admin_token");
              localStorage.removeItem("admin_refresh_token");
              localStorage.removeItem("admin_user");
              setUser(null);
              setToken(null);
            }
          } else {
            // Token valid — update profile from server
            res.json().then((profile) => {
              const updatedUser = {
                id: profile.id,
                email: profile.email,
                name: profile.userName || profile.name || "Admin",
                role: profile.role || "user",
              };
              localStorage.setItem("admin_user", JSON.stringify(updatedUser));
              setUser(updatedUser as User);
            }).catch(() => {});
          }
        }).catch(() => {
          // Network error — keep existing session (might be offline)
        });
      } catch (err) {
        console.error("Failed to parse admin_user", err);
        localStorage.removeItem("admin_user");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_refresh_token");
      }
    }
    setLoading(false);
  }, []);

  // Listen for session-expired events from adminFetch
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn("[Admin Auth] Session expired event received. Clearing session.");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_refresh_token");
      localStorage.removeItem("admin_user");
      setUser(null);
      setToken(null);
    };
    window.addEventListener("admin:session-expired", handleSessionExpired);
    return () => window.removeEventListener("admin:session-expired", handleSessionExpired);
  }, []);

  const login = async (email: string) => {
    try {
      const res = await adminClient.auth.login(email);
      return { success: true, token: res.data.token };
    } catch (err: any) {
      throw new Error(err.message || "Failed to log in");
    }
  };

  const register = async (name: string, email: string) => {
    try {
      const res = await adminClient.auth.register(name, email);
      return { success: true, token: res.data.token };
    } catch (err: any) {
      throw new Error(err.message || "Failed to register");
    }
  };

  const verifyOtp = async (email: string, otp: string, emailToken: string) => {
    try {
      const res = await adminClient.auth.verifyOtp(emailToken, otp, email);
      const { accessToken, refreshToken, user: userData } = res.data;
      localStorage.setItem("admin_token", accessToken);
      localStorage.setItem("admin_refresh_token", refreshToken);
      localStorage.setItem("admin_user", JSON.stringify(userData));

      setUser(userData);
      setToken(accessToken);
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
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_refresh_token");
    localStorage.removeItem("admin_user");
    setUser(null);
    setToken(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
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
