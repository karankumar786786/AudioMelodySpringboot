"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Mail, User, Lock, ArrowRight, RefreshCw, Music, ShieldCheck, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AuthScreen() {
  const { login, register, verifyOtp, resendOtp } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "otp">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [emailToken, setEmailToken] = useState("");
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer effect
  useEffect(() => {
    if (mode !== "otp" || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, countdown]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        const res = await login(email);
        setEmailToken(res.token);
      } else {
        if (!name) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        const res = await register(name, email);
        setEmailToken(res.token);
      }
      setMode("otp");
      setCountdown(300);
      // Reset OTP fields
      setOtp(Array(6).fill(""));
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return; // Allow numbers only (or backspace)
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Trigger verify automatically when 6 digits are typed
  useEffect(() => {
    if (mode === "otp" && otp.every((digit) => digit !== "")) {
      handleOtpVerify();
    }
  }, [otp, mode]);

  const handleOtpVerify = async () => {
    setLoading(true);
    setError(null);
    const otpCode = otp.join("");
    try {
      await verifyOtp(email, otpCode, emailToken);
      // Auth context will automatically update user state, closing this screen
    } catch (err: any) {
      setError(err.message || "Invalid OTP code");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return; // Prevent spamming
    setLoading(true);
    setError(null);
    try {
      const res = await resendOtp(email, emailToken);
      if (res.token) {
        setEmailToken(res.token);
      }
      setCountdown(300);
      setOtp(Array(6).fill(""));
      otpInputsRef.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 text-white overflow-hidden font-sans">
      {/* Background glowing rings */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />

      {/* Card container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md backdrop-blur-xl bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        {/* Header Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200">
            {mode === "otp"
              ? "Verify OTP"
              : mode === "login"
              ? "Admin Sign In"
              : "Create Admin Account"}
          </h2>
          <p className="text-zinc-500 text-sm mt-1 text-center font-medium">
            {mode === "otp"
              ? `Verification frequency dispatched to ${email}`
              : "Enter your secure credentials to sync node."}
          </p>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-semibold"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {mode !== "otp" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-5">
            {mode === "register" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">
                  Full Name
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                    <User className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Super Admin"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-800/80 rounded-2xl py-3 pl-12 pr-4 text-sm font-semibold focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-zinc-700"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">
                Email Address
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="admin@onemelody.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800/80 rounded-2xl py-3 pl-12 pr-4 text-sm font-semibold focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-zinc-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold text-sm uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-indigo-500/10 transition-all active:scale-98 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 group mt-6"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Send OTP Code
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center mt-6">
              {mode === "login" ? (
                <p className="text-xs text-zinc-500 font-medium">
                  Need to construct an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                  >
                    Register here
                  </button>
                </p>
              ) : (
                <p className="text-xs text-zinc-500 font-medium">
                  Already synced?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                  >
                    Sign in here
                  </button>
                </p>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* OTP input boxes */}
            <div className="flex justify-between gap-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  required
                  ref={(el) => { otpInputsRef.current[idx] = el; }}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-12 h-14 bg-black/40 border border-zinc-800/80 rounded-xl text-center text-xl font-black focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              ))}
            </div>

            {/* Resend and timer */}
            <div className="flex items-center justify-between text-xs px-1">
              {countdown > 0 ? (
                <span className="text-zinc-500 font-medium">
                  Resend available in{" "}
                  <span className="text-indigo-400 font-bold">
                    {formatTime(countdown)}
                  </span>
                </span>
              ) : (
                <span className="text-zinc-400 font-medium">
                  Didn't receive a code?{" "}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                  >
                    Resend Code
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={handleOtpVerify}
              disabled={loading || otp.some((d) => d === "")}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold text-sm uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-indigo-500/10 transition-all active:scale-98 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Verify & Connect
                  <ShieldCheck className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(name ? "register" : "login");
                setError(null);
              }}
              className="w-full border border-zinc-800 hover:bg-white/5 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-widest py-3 rounded-2xl transition-all"
            >
              Change Email
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
