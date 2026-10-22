"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { musicApi } from "@/lib/api";
import { playerActions } from "@/store/player.store";
import type { AuthView } from "./types";

interface UseAuthFlowOptions {
  onSuccess?: () => void;
  onNavigateHome?: () => void;
}

export function useAuthFlow({ onSuccess, onNavigateHome }: UseAuthFlowOptions = {}) {
  const [view, setView] = useState<AuthView>("register");
  const [authOrigin, setAuthOrigin] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [timeLeft, setTimeLeft] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const resetFlow = (defaultView: AuthView = "register") => {
    isVerifyingRef.current = false;
    setView(defaultView);
    setAuthOrigin(defaultView === "login" ? "login" : "register");
    setEmail("");
    setName("");
    setSessionToken("");
    setOtpValues(Array(6).fill(""));
    setTimeLeft(300);
    setResendCooldown(30);
    setTimerActive(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await musicApi.auth.login(email);
      setSessionToken(res.data.token);
      setAuthOrigin("login");
      setView("otp");
      setTimeLeft(300);
      setResendCooldown(30);
      setTimerActive(true);
      toast.success("OTP Code Sent", {
        description: `Verification code sent to ${email}`,
      });
    } catch (err: any) {
      toast.error("Login Failed", {
        description: err.response?.data?.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    setLoading(true);
    try {
      const res = await musicApi.auth.register(name, email);
      setSessionToken(res.data.token);
      setAuthOrigin("register");
      setView("otp");
      setTimeLeft(300);
      setResendCooldown(30);
      setTimerActive(true);
      toast.success("OTP Code Sent", {
        description: `Verification code sent to ${email}`,
      });
    } catch (err: any) {
      toast.error("Registration Failed", {
        description: err.response?.data?.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (loading || resendCooldown > 0) return;
    setLoading(true);
    try {
      const res = await musicApi.auth.resendOtp(sessionToken);
      if (res?.data?.token) {
        setSessionToken(res.data.token);
      }
      setTimeLeft(300);
      setResendCooldown(30);
      setOtpValues(Array(6).fill(""));
      toast.success("Code Resent", {
        description: "A fresh verification code has been sent to your email",
      });
    } catch (err: any) {
      toast.error("Resend Failed", {
        description: err.response?.data?.message || "Could not resend code",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    if (isVerifyingRef.current || loading) return;

    const code = codeToVerify || otpValues.join("");
    if (code.length !== 6) {
      toast.error("Incomplete Code", {
        description: "Please enter all 6 digits of the verification code",
      });
      return;
    }
    isVerifyingRef.current = true;
    setLoading(true);
    try {
      const res = await musicApi.auth.verifyOtp(sessionToken, code);
      playerActions.setSystemSession(res.data.user);

      if (res.data.isNewUser) {
        setView("onboarding");
      } else {
        toast.success("Welcome back!", {
          description: `Logged in as ${res.data.user.name || res.data.user.email}`,
        });
        onSuccess?.();
        onNavigateHome?.();
      }
    } catch (err: any) {
      toast.error("Verification Failed", {
        description: err.response?.data?.message || "Invalid or expired code",
      });
    } finally {
      isVerifyingRef.current = false;
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otpValues];
    newOtp[index] = digit;
    setOtpValues(newOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((d) => d !== "") && newOtp.join("").length === 6) {
      handleVerifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otpValues];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtpValues(newOtp);

    const nextEmptyIndex = newOtp.findIndex((v) => !v);
    if (nextEmptyIndex !== -1) {
      otpRefs.current[nextEmptyIndex]?.focus();
    } else {
      otpRefs.current[5]?.focus();
      if (pasted.length === 6) {
        handleVerifyOtp(pasted);
      }
    }
  };

  return {
    view,
    setView,
    authOrigin,
    setAuthOrigin,
    email,
    setEmail,
    name,
    setName,
    loading,
    sessionToken,
    otpValues,
    setOtpValues,
    timeLeft,
    resendCooldown,
    timerActive,
    otpRefs,
    formatTime,
    resetFlow,
    handleLogin,
    handleRegister,
    handleResendOtp,
    handleVerifyOtp,
    handleOtpChange,
    handleKeyDown,
    handlePaste,
  };
}
