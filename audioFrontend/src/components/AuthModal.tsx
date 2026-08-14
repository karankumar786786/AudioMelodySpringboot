"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mail,
  User,
  Clock,
  ArrowLeft,
  Loader2,
  KeyRound,
} from "lucide-react";
import { playerStore, playerActions } from "@/store/player.store";
import { musicApi } from "@/lib/api";
import { toast } from "sonner";

type AuthView = "login" | "register" | "otp";

export function AuthModal() {
  const isAuthModalOpen = useStore(playerStore, (s) => s.isAuthModalOpen);
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [timerActive, setTimerActive] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state on open/close
  useEffect(() => {
    if (!isAuthModalOpen) {
      setView("login");
      setEmail("");
      setName("");
      setSessionToken("");
      setOtpValues(Array(6).fill(""));
      setTimerActive(false);
    }
  }, [isAuthModalOpen]);

  // Timer logic
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

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
      setView("otp");
      setTimeLeft(300);
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
      setView("otp");
      setTimeLeft(300);
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
    if (loading) return;
    setLoading(true);
    try {
      const res = await musicApi.auth.resendOtp(sessionToken);
      setSessionToken(res.data.token);
      setOtpValues(Array(6).fill(""));
      setTimeLeft(300);
      setTimerActive(true);
      toast.success("OTP Resent", {
        description: "A new security code has been sent to your email.",
      });
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      toast.error("Resend Failed", {
        description: err.response?.data?.message || "Could not resend OTP",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpValues.join("");
    if (code.length < 6) return;
    setLoading(true);
    try {
      const res = await musicApi.auth.verifyOtp(sessionToken, code);
      const { accessToken, refreshToken, user } = res.data;

      // Set session in global store
      playerActions.setSystemSession(accessToken, refreshToken, user);

      toast.success(`Welcome back, ${user.name}!`, {
        description: "You are now logged in.",
      });

      // Fetch user favorites
      playerActions.fetchFavourites();

      playerActions.closeAuthModal();
    } catch (err: any) {
      toast.error("Verification Failed", {
        description: err.response?.data?.message || "Invalid OTP code",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle single input box changes
  const handleOtpChange = (index: number, val: string) => {
    // Only accept numbers
    if (val && !/^\d$/.test(val)) return;

    const nextOtp = [...otpValues];
    nextOtp[index] = val;
    setOtpValues(nextOtp);

    // Autofocus shift forward
    if (val && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      if (!otpValues[index] && index > 0) {
        // Focus previous input on backspace if current is empty
        const nextOtp = [...otpValues];
        nextOtp[index - 1] = "";
        setOtpValues(nextOtp);
        otpRefs.current[index - 1]?.focus();
      } else {
        const nextOtp = [...otpValues];
        nextOtp[index] = "";
        setOtpValues(nextOtp);
      }
    }
  };

  // Auto submit when 6 digits are typed
  useEffect(() => {
    if (otpValues.join("").length === 6 && view === "otp") {
      handleVerifyOtp();
    }
  }, [otpValues, view]);

  if (!isAuthModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => playerActions.closeAuthModal()}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-xl border border-[#282828] bg-[#181818] p-8 shadow-2xl"
        >
          {/* Close Button */}
          <button
            onClick={() => playerActions.closeAuthModal()}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <AnimatePresence mode="wait">
            {view === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Welcome Back
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Enter your email to sign in to OneMelody
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-zinc-900/50 py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-emerald-400 text-black font-semibold py-2.5 transition-all disabled:opacity-50 text-sm shadow-lg shadow-primary/20 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send OTP Code"
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center text-xs text-zinc-500">
                  New to OneMelody?{" "}
                  <button
                    onClick={() => setView("register")}
                    className="text-primary hover:text-emerald-400 font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Create an account
                  </button>
                </div>
              </motion.div>
            )}

            {view === "register" && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Get Started
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Create your OneMelody account today
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Your Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-zinc-900/50 py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-zinc-900/50 py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email || !name}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-emerald-400 text-black font-semibold py-2.5 transition-all disabled:opacity-50 text-sm shadow-lg shadow-primary/20 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send OTP Code"
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center text-xs text-zinc-500">
                  Already have an account?{" "}
                  <button
                    onClick={() => setView("login")}
                    className="text-primary hover:text-emerald-400 font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Sign in
                  </button>
                </div>
              </motion.div>
            )}

            {view === "otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => setView("login")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white tracking-wider mb-5 transition-colors uppercase bg-transparent border-none cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </button>

                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Verify Your Email
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    We sent a 6-digit security code to{" "}
                    <strong className="text-zinc-200">{email}</strong>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  {/* 6 Digit Input Group */}
                  <div className="flex justify-between gap-2.5">
                    {otpValues.map((val, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpRefs.current[idx] = el;
                        }}
                        type="text"
                        maxLength={1}
                        value={val}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className="w-12 h-14 text-center text-2xl font-bold rounded-xl border border-white/10 bg-zinc-900/50 text-white placeholder-zinc-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all shadow-md shadow-black/50"
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  {/* Countdown and Actions */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>
                        {timeLeft > 0 ? (
                          `Expires in ${formatTime(timeLeft)}`
                        ) : (
                          <span className="text-red-400 font-semibold">
                            Code Expired
                          </span>
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={loading || timeLeft > 0}
                      onClick={handleResendOtp}
                      className="text-xs font-semibold text-primary hover:text-emerald-400 hover:underline uppercase tracking-widest disabled:opacity-30 disabled:hover:no-underline bg-transparent border-none cursor-pointer"
                    >
                      Resend Code
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpValues.join("").length < 6}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-emerald-400 text-black font-semibold py-2.5 transition-all disabled:opacity-50 text-sm shadow-lg shadow-primary/20 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Verify OTP & Sign In"
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
