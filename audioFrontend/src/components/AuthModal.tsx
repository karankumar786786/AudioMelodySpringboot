"use client";

import React, { useEffect } from "react";
import { useStore } from "@tanstack/react-store";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { playerActions, playerStore } from "@/store/player.store";
import { ArtistOnboardingView } from "./ArtistOnboardingView";
import { AuthEmailForm, AuthOtpForm, useAuthFlow } from "./auth";

export function AuthModal() {
  const isAuthModalOpen = useStore(playerStore, (s) => s.isAuthModalOpen);

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
      playerActions.closeAuthModal();
    },
  });

  // Reset state when modal is toggled
  useEffect(() => {
    if (!isAuthModalOpen) {
      resetFlow("register");
    }
  }, [isAuthModalOpen]);

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
          className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full overflow-hidden rounded-2xl border border-[#282828] bg-[#121212] shadow-2xl transition-all duration-300 ${
            view === "onboarding" ? "max-w-3xl p-0" : "max-w-md p-8"
          }`}
        >
          {/* Close Button */}
          <button
            onClick={() => playerActions.closeAuthModal()}
            className="absolute top-4 right-4 z-30 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close authentication modal"
          >
            <X className="h-5 w-5" />
          </button>

          <AnimatePresence mode="wait">
            {(view === "login" || view === "register") && (
              <motion.div
                key={view}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {view === "register" ? "Create an Account" : "Welcome Back"}
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    {view === "register"
                      ? "Sign up to start streaming and saving tracks"
                      : "Enter your email to sign in to OneMelody"}
                  </p>
                </div>

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
                key="otp"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
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
                key="onboarding"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                <ArtistOnboardingView
                  userName={name}
                  onComplete={() => {
                    playerActions.fetchFavourites();
                    playerActions.closeAuthModal();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
