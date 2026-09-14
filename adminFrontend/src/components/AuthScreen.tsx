"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Mail, User, ArrowRight, RefreshCw, ShieldCheck, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AuthScreen() {
  const { login, register, verifyOtp, resendOtp } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "otp">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [emailToken, setEmailToken] = useState("");
  const [resendCooldown, setResendCooldown] = useState(30); // 30 seconds cooldown for resending
  const [expiresIn, setExpiresIn] = useState(300); // 5 minutes code validity
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer effect for resend cooldown & code expiry
  useEffect(() => {
    if (mode !== "otp") return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [mode]);

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
      setResendCooldown(30);
      setExpiresIn(300);
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
    if (resendCooldown > 0) return; // Prevent spamming before cooldown
    setLoading(true);
    setError(null);
    try {
      const res = await resendOtp(email, emailToken);
      if (res.token) {
        setEmailToken(res.token);
      }
      setResendCooldown(30);
      setExpiresIn(300);
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
    <div className="relative flex min-h-screen items-center justify-center bg-black px-4 py-12 text-white overflow-hidden font-sans">
      {/* Subtle monochrome ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-[140px] pointer-events-none" />

      {/* Card container */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-[#121212] border border-[#282828] rounded-3xl p-8 shadow-2xl relative z-10"
      >
        {/* Header Icon / Official Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-[#282828] p-2 flex items-center justify-center mb-4 shadow-inner">
            <img
              src="/image.png"
              alt="One Melody Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              One Melody
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-black uppercase tracking-wider">
              Admin
            </span>
          </div>
          <p className="text-zinc-400 text-xs mt-1.5 text-center">
            {mode === "otp"
              ? `Enter verification code sent to ${email}`
              : "Sign in with your administrator credentials"}
          </p>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-3.5 bg-red-950/40 border border-red-800/50 rounded-2xl flex items-center gap-3 text-red-300 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {mode !== "otp" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider pl-1">
                  Full Name
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 group-focus-within:text-white transition-colors">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Admin Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/60 border border-[#282828] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider pl-1">
                Email Address
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 group-focus-within:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="admin@onemelody.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/60 border border-[#282828] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black hover:bg-zinc-200 font-bold text-sm tracking-wide py-3.5 rounded-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 group mt-6"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              {mode === "login" ? (
                <p className="text-xs text-zinc-400 font-normal">
                  Need to create an admin account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                    }}
                    className="text-white hover:underline font-semibold ml-1 transition-colors"
                  >
                    Register
                  </button>
                </p>
              ) : (
                <p className="text-xs text-zinc-400 font-normal">
                  Already registered?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className="text-white hover:underline font-semibold ml-1 transition-colors"
                  >
                    Sign In
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
                  className="w-12 h-14 bg-black/60 border border-[#282828] rounded-xl text-center text-xl font-bold text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all"
                />
              ))}
            </div>

            {/* Expiration & Resend Cooldown */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-zinc-400">
                {expiresIn > 0 ? (
                  <>
                    Expires in{" "}
                    <span className="text-white font-mono font-semibold">
                      {formatTime(expiresIn)}
                    </span>
                  </>
                ) : (
                  <span className="text-rose-400 font-semibold">
                    Code expired
                  </span>
                )}
              </span>

              {resendCooldown > 0 ? (
                <span className="text-zinc-400">
                  Resend in{" "}
                  <span className="text-white font-mono font-semibold">
                    {resendCooldown}s
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-white hover:underline font-semibold transition-colors disabled:opacity-50"
                >
                  Resend Code
                </button>
              )}
            </div>

            <button
              onClick={handleOtpVerify}
              disabled={loading || otp.some((d) => d === "")}
              className="w-full bg-white text-black hover:bg-zinc-200 font-bold text-sm tracking-wide py-3.5 rounded-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <span>Verify & Access Console</span>
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
              className="w-full border border-[#282828] hover:bg-white/5 text-zinc-400 hover:text-white font-semibold text-xs py-3 rounded-full transition-all"
            >
              Back to Email
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
