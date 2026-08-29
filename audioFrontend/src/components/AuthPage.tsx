"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@tanstack/react-store";
import { motion, AnimatePresence } from "framer-motion";
import {
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

interface AuthPageProps {
  initialMode?: "login" | "signup";
}

export function AuthPage({ initialMode = "login" }: AuthPageProps) {
  const router = useRouter();
  const systemUser = useStore(playerStore, (s) => s.systemUser);

  const [view, setView] = useState<"login" | "register" | "otp">(
    initialMode === "signup" ? "register" : "login"
  );
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [timerActive, setTimerActive] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If user is already loaded/logged in, don't show the auth form; redirect to /home
  useEffect(() => {
    if (systemUser) {
      router.replace("/home");
    }
  }, [systemUser, router]);

  useEffect(() => {
    setView(initialMode === "signup" ? "register" : "login");
    setOtpValues(Array(6).fill(""));
    setTimerActive(false);
  }, [initialMode]);

  // OTP Timer countdown
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
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await musicApi.auth.login(email.trim());
      setSessionToken(res.data.token);
      setView("otp");
      setTimeLeft(300);
      setTimerActive(true);
      toast.success("OTP Code Sent", {
        description: `Verification code sent to ${email}`,
      });
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      toast.error("Sign In Failed", {
        description: err.response?.data?.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setLoading(true);
    try {
      const res = await musicApi.auth.register(name.trim(), email.trim());
      setSessionToken(res.data.token);
      setView("otp");
      setTimeLeft(300);
      setTimerActive(true);
      toast.success("OTP Code Sent", {
        description: `Verification code sent to ${email}`,
      });
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      toast.error("Registration Failed", {
        description: err.response?.data?.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (loading || !sessionToken) return;
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

  const handleVerifyWithCode = async (code: string) => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const res = await musicApi.auth.verifyOtp(sessionToken, code);
      const { accessToken, refreshToken, user } = res.data;

      // Set session in global store and storage
      playerActions.setSystemSession(accessToken, refreshToken, user);

      toast.success(`Welcome to One Melody, ${user.name}!`, {
        description: "You are now logged in.",
      });

      playerActions.fetchFavourites();
      router.replace("/home");
    } catch (err: any) {
      toast.error("Verification Failed", {
        description: err.response?.data?.message || "Invalid OTP code",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpValues.join("");
    if (code.length < 6) return;
    await handleVerifyWithCode(code);
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val && !/^\d$/.test(val)) return;

    const nextOtp = [...otpValues];
    nextOtp[index] = val;
    setOtpValues(nextOtp);

    // Auto-focus next input
    if (val && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits are entered
    if (val && index === 5 && nextOtp.every((d) => d !== "")) {
      const fullCode = nextOtp.join("");
      if (fullCode.length === 6) {
        setTimeout(() => {
          handleVerifyWithCode(fullCode);
        }, 50);
      }
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      if (!otpValues[index] && index > 0) {
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

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (!/^\d+$/.test(pasted)) return;

    const chars = pasted.slice(0, 6).split("");
    const nextOtp = [...otpValues];
    chars.forEach((char, i) => {
      nextOtp[i] = char;
    });
    setOtpValues(nextOtp);

    if (chars.length === 6) {
      otpRefs.current[5]?.focus();
      handleVerifyWithCode(nextOtp.join(""));
    } else {
      otpRefs.current[Math.min(chars.length, 5)]?.focus();
    }
  };

  // If already authenticated, show nothing while router replaces with /home
  if (systemUser) {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-black text-white p-4 sm:p-6 relative">
      {/* Top Left Logo matching LeftSidebar exactly */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-3 z-20">
        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden shrink-0">
          <img
            src="/image.png"
            alt="One Melody Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <span className="text-xl font-black text-white tracking-tight">
          One Melody
        </span>
      </div>

      {/* Main Form Container matching App Theme with smooth layout resizing */}
      <main className="w-full max-w-[420px] my-auto pt-16 pb-8">
        <motion.div
          layout
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="rounded-xl border border-[#282828] bg-[#181818] p-7 sm:p-8 shadow-2xl"
        >
          {/* View Switcher Tabs (Only if not in OTP step) */}
          {view !== "otp" && (
            <motion.div
              layout
              className="relative flex items-center bg-[#121212] p-1 rounded-lg mb-6 border border-[#282828]"
            >
              <button
                type="button"
                onClick={() => setView("login")}
                className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-md transition-colors duration-200 cursor-pointer ${
                  view === "login" ? "text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {view === "login" && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-[#282828] rounded-md shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">Log In</span>
              </button>

              <button
                type="button"
                onClick={() => setView("register")}
                className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-md transition-colors duration-200 cursor-pointer ${
                  view === "register" ? "text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {view === "register" && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-[#282828] rounded-md shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">Sign Up</span>
              </button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* LOGIN FORM */}
            {view === "login" && (
              <motion.div
                key="login-view"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
              >
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-zinc-900/80 py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-primary  text-black font-bold py-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 text-sm shadow-lg shadow-primary/20 cursor-pointer mt-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send OTP Code"
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center text-xs text-zinc-400">
                  New to One Melody?{" "}
                  <button
                    type="button"
                    onClick={() => setView("register")}
                    className="text-primary hover:text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    Create an account
                  </button>
                </div>
              </motion.div>
            )}

            {/* REGISTER FORM */}
            {view === "register" && (
              <motion.div
                key="register-view"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
              >
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                      Your Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-zinc-900/80 py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-zinc-900/80 py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email.trim() || !name.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-primary hover:bg-emerald-400 text-black font-bold py-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 text-sm shadow-lg shadow-primary/20 cursor-pointer mt-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Create Account"
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center text-xs text-zinc-400">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="text-primary hover:text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </div>
              </motion.div>
            )}

            {/* OTP VERIFICATION */}
            {view === "otp" && (
              <motion.div
                key="otp-view"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
              >
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white tracking-wider mb-5 transition-colors uppercase cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </button>

                <div className="text-center mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-3">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Verify Your Email
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1.5">
                    We sent a 6-digit security code to{" "}
                    <strong className="text-zinc-200">{email}</strong>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  {/* 6 Digit Input Group */}
                  <div
                    className="flex justify-between gap-2 sm:gap-2.5"
                    onPaste={handlePaste}
                  >
                    {otpValues.map((val, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={val}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className={`w-11 sm:w-12 h-14 text-center text-xl font-bold rounded-xl border transition-all focus:outline-none ${
                          val
                            ? "bg-[#181818] border-primary text-white ring-1 ring-primary"
                            : "bg-zinc-900/80 border-white/10 text-white focus:border-primary focus:ring-1 focus:ring-primary"
                        }`}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  {/* Countdown and Resend */}
                  <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" />
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
                      disabled={loading || timeLeft > 240}
                      onClick={handleResendOtp}
                      className="text-xs font-semibold text-primary hover:text-emerald-400 hover:underline uppercase tracking-wider disabled:opacity-30 disabled:hover:no-underline cursor-pointer"
                    >
                      Resend Code
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpValues.join("").length < 6}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-primary  text-black font-bold py-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 text-sm shadow-lg shadow-primary/20 cursor-pointer"
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
      </main>

      {/* Subtle Bottom Footer */}
      <footer className="w-full max-w-md py-6 text-center text-[11px] text-zinc-600">
        <p>© {new Date().getFullYear()} One Melody. All rights reserved.</p>
      </footer>
    </div>
  );
}
