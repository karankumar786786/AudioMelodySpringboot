"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@tanstack/react-store";
import { AnimatePresence, motion } from "framer-motion";
import { playerActions, playerStore } from "@/store/player.store";
import { ArtistOnboardingView } from "./ArtistOnboardingView";
import { AuthEmailForm, AuthOtpForm, useAuthFlow } from "./auth";

interface AuthPageProps {
  initialMode?: "login" | "signup";
}

export function AuthPage({ initialMode = "signup" }: AuthPageProps) {
  const router = useRouter();
  const systemUser = useStore(playerStore, (s) => s.systemUser);

  const {
    view,
    setView,
    email,
    setEmail,
    name,
    setName,
    loading,
    otpValues,
    timeLeft,
    resendCooldown,
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
  } = useAuthFlow({
    onSuccess: () => {
      playerActions.fetchFavourites();
    },
    onNavigateHome: () => {
      router.replace("/home");
    },
  });

  // If user is already loaded/logged in, redirect to /home
  useEffect(() => {
    if (systemUser && view !== "onboarding") {
      router.replace("/home");
    }
  }, [systemUser, router, view]);

  useEffect(() => {
    resetFlow(initialMode === "login" ? "login" : "register");
  }, [initialMode]);

  if (systemUser && view !== "onboarding") {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-black text-white p-4 sm:p-6 relative">
      {/* Top Left Logo matching LeftSidebar exactly */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-3 z-20">
        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
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
      <main
        className={`w-full my-auto pt-16 pb-8 transition-all duration-300 ${
          view === "onboarding" ? "max-w-3xl" : "max-w-105"
        }`}
      >
        <motion.div
          layout
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className={`rounded-2xl border border-[#282828] bg-[#121212] shadow-2xl ${
            view === "onboarding" ? "p-0 overflow-hidden" : "p-7 sm:p-8"
          }`}
        >
          {/* View Switcher Tabs (Only if not in OTP step) */}
          {view !== "otp" && view !== "onboarding" && (
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
            {(view === "login" || view === "register") && (
              <motion.div
                key={view}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
              >
                <AuthEmailForm
                  view={view}
                  email={email}
                  setEmail={setEmail}
                  name={name}
                  setName={setName}
                  loading={loading}
                  onSubmit={view === "register" ? handleRegister : handleLogin}
                  onSwitchView={(v) => setView(v)}
                />
              </motion.div>
            )}

            {view === "otp" && (
              <motion.div
                key="otp-view"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
              >
                <AuthOtpForm
                  email={email}
                  otpValues={otpValues}
                  timeLeft={timeLeft}
                  resendCooldown={resendCooldown}
                  loading={loading}
                  otpRefs={otpRefs}
                  formatTime={formatTime}
                  onOtpChange={handleOtpChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onVerify={() => handleVerifyOtp()}
                  onResend={handleResendOtp}
                  onBack={() => setView("login")}
                />
              </motion.div>
            )}

            {view === "onboarding" && (
              <motion.div
                key="onboarding-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                <ArtistOnboardingView
                  userName={name}
                  onComplete={() => {
                    playerActions.fetchFavourites();
                    router.replace("/home");
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Footer Branding */}
      <footer className="text-zinc-600 text-xs py-4 select-none">
        &copy; {new Date().getFullYear()} One Melody. All rights reserved.
      </footer>
    </div>
  );
}
