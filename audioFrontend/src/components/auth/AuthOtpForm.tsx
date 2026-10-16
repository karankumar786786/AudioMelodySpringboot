"use client";

import React, { type RefObject } from "react";
import { ArrowLeft, Clock, KeyRound, Loader2 } from "lucide-react";

interface AuthOtpFormProps {
  email: string;
  otpValues: string[];
  timeLeft: number;
  resendCooldown: number;
  loading: boolean;
  otpRefs: RefObject<(HTMLInputElement | null)[]>;
  formatTime: (seconds: number) => string;
  onOtpChange: (index: number, val: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
}

export function AuthOtpForm({
  email,
  otpValues,
  timeLeft,
  resendCooldown,
  loading,
  otpRefs,
  formatTime,
  onOtpChange,
  onKeyDown,
  onPaste,
  onVerify,
  onResend,
  onBack,
}: AuthOtpFormProps) {
  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to email</span>
      </button>

      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-primary mb-3">
          <KeyRound size={22} />
        </div>
        <h3 className="text-lg font-bold text-white">Enter Verification Code</h3>
        <p className="text-xs text-zinc-400">
          We sent a 6-digit code to{" "}
          <span className="text-white font-medium">{email}</span>
        </p>
      </div>

      {/* 6-box OTP input */}
      <div className="flex justify-center gap-2 sm:gap-2.5">
        {otpValues.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              if (otpRefs.current) {
                otpRefs.current[index] = el;
              }
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => onOtpChange(index, e.target.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            onPaste={index === 0 ? onPaste : undefined}
            className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold bg-[#181818] border border-[#282828] focus:border-primary focus:bg-black rounded-xl text-white outline-none transition-all"
            autoFocus={index === 0}
          />
        ))}
      </div>

      {/* Timer and Resend */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-1.5 text-zinc-400 font-mono">
          <Clock size={13} className={timeLeft < 60 ? "text-amber-400" : "text-zinc-500"} />
          <span className={timeLeft < 60 ? "text-amber-400 font-semibold" : ""}>
            Expires in {formatTime(timeLeft)}
          </span>
        </div>

        <button
          type="button"
          disabled={resendCooldown > 0 || loading}
          onClick={onResend}
          className="text-xs font-semibold text-primary hover:underline disabled:text-zinc-600 disabled:no-underline cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Resend Code"}
        </button>
      </div>

      <button
        type="button"
        disabled={loading || otpValues.join("").length !== 6 || timeLeft === 0}
        onClick={onVerify}
        className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify & Continue"}
      </button>
    </div>
  );
}
