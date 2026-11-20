"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { emailField } from "@/lib/forms/schemas";

/** Mirrors /auth/login and /auth/register: email always, name when registering. */
const emailFormSchema = z
  .object({
    mode: z.enum(["login", "register"]),
    email: emailField,
    name: z.string().trim(),
  })
  .refine((v) => v.mode === "login" || v.name.length > 0, {
    path: ["name"],
    message: "Name is required",
  });
type EmailForm = z.infer<typeof emailFormSchema>;

/** /auth/verify-otp expects the six-digit code. */
const otpSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

export function AuthScreen() {
  const { login, register, verifyOtp, resendOtp } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "otp">("login");
  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { mode: "login", email: "", name: "" },
  });
  const email = emailForm.watch("email");
  const name = emailForm.watch("name");
  const formErrors = emailForm.formState.errors;
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

  // Keep the schema's mode in step with the tab.
  useEffect(() => {
    if (mode !== "otp") emailForm.setValue("mode", mode);
  }, [mode, emailForm]);

  const handleEmailSubmit = emailForm.handleSubmit(
    async ({ mode: formMode, email: addr, name: fullName }) => {
      setLoading(true);
      setError(null);
      try {
        const res =
          formMode === "login"
            ? await login(addr)
            : await register(fullName, addr);
        setEmailToken(res.token);
        setMode("otp");
        setResendCooldown(30);
        setExpiresIn(300);
        setOtp(Array(6).fill(""));
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Something went wrong. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
  );

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

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Trigger verify automatically when 6 digits are typed
  // biome-ignore lint/correctness/useExhaustiveDependencies: verify only when the digits change, not when the handler is recreated
  useEffect(() => {
    if (mode === "otp" && otp.every((digit) => digit !== "")) {
      handleOtpVerify();
    }
  }, [otp, mode]);

  const handleOtpVerify = async () => {
    const otpCode = otp.join("");
    const parsed = otpSchema.safeParse(otpCode);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid OTP code");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(email.trim().toLowerCase(), otpCode, emailToken);
      // Auth context will automatically update user state, closing this screen
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : "Invalid OTP code",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return; // Prevent spamming before cooldown
    setLoading(true);
    setError(null);
    try {
      const res = await resendOtp(email.trim().toLowerCase(), emailToken);
      if (res.token) {
        setEmailToken(res.token);
      }
      setResendCooldown(30);
      setExpiresIn(300);
      setOtp(Array(6).fill(""));
      otpInputsRef.current[0]?.focus();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Failed to resend OTP",
      );
    } finally {
      setLoading(false);
    }
  };

  const shownError =
    error ??
    (mode !== "otp"
      ? (formErrors.email?.message ?? formErrors.name?.message ?? null)
      : null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-4 py-12 text-white overflow-hidden font-sans">
      {/* Subtle monochrome ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-white/3 rounded-full blur-[140px] pointer-events-none" />

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
          {shownError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-3.5 bg-red-950/40 border border-red-800/50 rounded-2xl flex items-center gap-3 text-red-300 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span role="alert">{shownError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {mode !== "otp" ? (
          <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-name"
                  className="text-xs font-semibold text-zinc-300 uppercase tracking-wider pl-1"
                >
                  Full Name
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 group-focus-within:text-white transition-colors">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Admin Name"
                    aria-invalid={Boolean(formErrors.name)}
                    {...emailForm.register("name")}
                    className="w-full bg-black/60 border border-[#282828] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="auth-email"
                className="text-xs font-semibold text-zinc-300 uppercase tracking-wider pl-1"
              >
                Email Address
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 group-focus-within:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@onemelody.com"
                  aria-invalid={Boolean(formErrors.email)}
                  {...emailForm.register("email")}
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
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-position placeholders never reorder
                  key={idx}
                  type="text"
                  inputMode="numeric"
                  autoComplete={idx === 0 ? "one-time-code" : "off"}
                  aria-label={`Verification code digit ${idx + 1}`}
                  maxLength={1}
                  required
                  ref={(el) => {
                    otpInputsRef.current[idx] = el;
                  }}
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
              type="button"
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
