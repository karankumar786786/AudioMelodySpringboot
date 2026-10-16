"use client";

import React from "react";
import { Loader2, Mail, User } from "lucide-react";

interface AuthEmailFormProps {
  view: "login" | "register";
  email: string;
  setEmail: (val: string) => void;
  name: string;
  setName: (val: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchView: (v: "login" | "register") => void;
}

export function AuthEmailForm({
  view,
  email,
  setEmail,
  name,
  setName,
  loading,
  onSubmit,
  onSwitchView,
}: AuthEmailFormProps) {
  const isRegister = view === "register";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isRegister && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">
            Full Name
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-[#181818] border border-[#282828] rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
            />
            <User
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-300">
          Email Address
        </label>
        <div className="relative">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-[#181818] border border-[#282828] rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
          />
          <Mail
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isRegister ? (
          "Create Account"
        ) : (
          "Continue with Email"
        )}
      </button>

      <div className="text-center pt-2">
        <p className="text-xs text-zinc-400">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => onSwitchView(isRegister ? "login" : "register")}
            className="text-white font-semibold hover:underline cursor-pointer"
          >
            {isRegister ? "Log In" : "Sign Up"}
          </button>
        </p>
      </div>
    </form>
  );
}
