"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminClient } from "./api";

interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin" | "superadmin";
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
    // Hydrate session from localStorage
    const savedUser = localStorage.getItem("admin_user");
    const savedToken = localStorage.getItem("admin_token");
    if (savedUser && savedToken) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setToken(savedToken);
      } catch (err) {
        console.error("Failed to parse admin_user", err);
        localStorage.removeItem("admin_user");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_refresh_token");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string) => {
    try {
      const res = await adminClient.auth.login(email);
      return { success: true, token: res.data.token };
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Failed to log in");
    }
  };

  const register = async (name: string, email: string) => {
    try {
      const res = await adminClient.auth.register(name, email);
      return { success: true, token: res.data.token };
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Failed to register");
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
      throw new Error(err.response?.data?.message || "Failed to verify OTP");
    }
  };

  const resendOtp = async (email: string, emailToken: string) => {
    try {
      const res = await adminClient.auth.resendOtp(emailToken, email);
      return { success: true, token: res.data.token };
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Failed to resend OTP");
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
