"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string | null;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export function Toast({
  message,
  type = "success",
  onClose,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  const config = {
    success: {
      icon: CheckCircle2,
      bg: "bg-emerald-500/10 dark:bg-emerald-950/40",
      border: "border-emerald-500/30 dark:border-emerald-700/50",
      text: "text-emerald-800 dark:text-emerald-200",
      iconColor: "text-emerald-500",
    },
    error: {
      icon: AlertCircle,
      bg: "bg-rose-500/10 dark:bg-rose-950/40",
      border: "border-rose-500/30 dark:border-rose-700/50",
      text: "text-rose-800 dark:text-rose-200",
      iconColor: "text-rose-500",
    },
    info: {
      icon: Info,
      bg: "bg-blue-500/10 dark:bg-blue-950/40",
      border: "border-blue-500/30 dark:border-blue-700/50",
      text: "text-blue-800 dark:text-blue-200",
      iconColor: "text-blue-500",
    },
  }[type];

  const Icon = config.icon;

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed top-6 right-6 z-50 max-w-md pointer-events-auto"
        >
          <div
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/30 ${config.bg} ${config.border} ${config.text}`}
          >
            <Icon className={`w-5 h-5 shrink-0 ${config.iconColor}`} />
            <p className="text-sm font-medium pr-2 leading-snug">{message}</p>
            <button
              onClick={onClose}
              className="ml-auto p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
