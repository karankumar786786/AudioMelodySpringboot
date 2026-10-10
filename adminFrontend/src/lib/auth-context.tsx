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

function clearStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("admin_session_id");
  localStorage.removeItem("admin_refresh_session_id");
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_refresh_token");
  localStorage.removeItem("admin_user");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null); // Represents active session ID
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Hydrate session from localStorage and validate the session against backend
    const savedUser = localStorage.getItem("admin_user");
    const savedSessionId =
      localStorage.getItem("admin_session_id") ||
      localStorage.getItem("admin_token");

    if (savedUser && savedSessionId) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setToken(savedSessionId);

        // Validate the stateful Redis session against the backend
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        fetch(`${apiBase}/api/user/profile`, {
          headers: {
            "X-Session-Id": savedSessionId,
            "Authorization": `Session ${savedSessionId}`,
          },
          credentials: "include",
        }).then(async (res) => {
          if (!res.ok) {
            // Session is invalid or expired — try refreshing
            const refreshId =
              localStorage.getItem("admin_refresh_session_id") ||
              localStorage.getItem("admin_refresh_token");

            if (refreshId) {
              try {
                const refreshRes = await fetch(`${apiBase}/auth/refresh-token`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    refreshSessionId: refreshId,
                    refreshToken: refreshId,
                  }),
                  credentials: "include",
                });
                if (refreshRes.ok) {
                  const refreshData = await refreshRes.json();
                  const newSessionId = refreshData.sessionId || refreshData.accessToken;
                  const newRefreshId = refreshData.refreshSessionId || refreshData.refreshToken;

                  localStorage.setItem("admin_session_id", newSessionId);
                  localStorage.setItem("admin_refresh_session_id", newRefreshId);
                  localStorage.setItem("admin_token", newSessionId);
                  localStorage.setItem("admin_refresh_token", newRefreshId);
                  setToken(newSessionId);

                  // Re-fetch profile with new session
                  const profileRes = await fetch(`${apiBase}/api/user/profile`, {
                    headers: {
                      "X-Session-Id": newSessionId,
                      "Authorization": `Session ${newSessionId}`,
                    },
                    credentials: "include",
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
                    console.warn("[Admin Auth] Session refresh succeeded but profile fetch failed. Clearing session.");
                    clearStorage();
                    setUser(null);
                    setToken(null);
                    if (typeof window !== "undefined" && window.location.pathname !== "/") {
                      router.push("/");
                    }
                  }
                } else {
                  console.warn("[Admin Auth] Session refresh failed. Clearing stale session.");
                  clearStorage();
                  setUser(null);
                  setToken(null);
                  if (typeof window !== "undefined" && window.location.pathname !== "/") {
                    router.push("/");
                  }
                }
              } catch {
                clearStorage();
                setUser(null);
                setToken(null);
                if (typeof window !== "undefined" && window.location.pathname !== "/") {
                  router.push("/");
                }
              }
            } else {
              console.warn("[Admin Auth] No refresh session available. Clearing stale session.");
              clearStorage();
              setUser(null);
              setToken(null);
              if (typeof window !== "undefined" && window.location.pathname !== "/") {
                router.push("/");
              }
            }
          } else {
            // Session valid — update profile from server
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
          // Network error — keep existing session
        });
      } catch (err) {
        console.error("Failed to parse admin_user", err);
        clearStorage();
        if (typeof window !== "undefined" && window.location.pathname !== "/") {
          router.push("/");
        }
      }
    } else {
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        router.push("/");
      }
    }
    setLoading(false);
  }, [router]);

  // Listen for session-expired events from adminFetch
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn("[Admin Auth] Session expired event received. Redirecting to login.");
      clearStorage();
      setUser(null);
      setToken(null);
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        router.push("/");
      }
    };
    window.addEventListener("admin:session-expired", handleSessionExpired);
    return () => window.removeEventListener("admin:session-expired", handleSessionExpired);
  }, [router]);

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
      const { sessionId, refreshSessionId, user: userData } = res.data;
      localStorage.setItem("admin_session_id", sessionId);
      localStorage.setItem("admin_refresh_session_id", refreshSessionId);
      localStorage.setItem("admin_token", sessionId);
      localStorage.setItem("admin_refresh_token", refreshSessionId);
      localStorage.setItem("admin_user", JSON.stringify(userData));

      setUser(userData);
      setToken(sessionId);
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
    const currentSessionId =
      localStorage.getItem("admin_session_id") ||
      localStorage.getItem("admin_token");
    fetch(`${apiBase}/auth/logout`, {
      method: "POST",
      headers: currentSessionId ? { "X-Session-Id": currentSessionId } : {},
      credentials: "include",
    }).catch(() => {});
    clearStorage();
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
