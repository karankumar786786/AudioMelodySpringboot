"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Laptop,
  Smartphone,
  Shield,
  ShieldAlert,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi, type UserSession } from "@/lib/api";

interface ConnectedDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectedDevicesModal({ isOpen, onClose }: ConnectedDevicesModalProps) {
  const [mounted, setMounted] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setCurrentDeviceId(localStorage.getItem("melody_device_id"));
    }
  }, []);

  const {
    data: sessions = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["user-sessions"],
    queryFn: () => musicApi.users.getSessions(),
    enabled: isOpen,
    staleTime: 1000 * 30,
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => musicApi.users.revokeSession(sessionId),
    onSuccess: () => {
      toast.success("Device session revoked");
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
    },
    onError: () => {
      toast.error("Failed to revoke session. Please try again.");
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: () => musicApi.users.revokeOtherSessions(),
    onSuccess: (data) => {
      toast.success(data?.message || "All other sessions revoked successfully");
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
    },
    onError: () => {
      toast.error("Failed to revoke other sessions. Please try again.");
    },
  });

  if (!mounted || !isOpen) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const hasOtherSessions = sessions.some(
    (s) => !s.isCurrent && s.deviceId !== currentDeviceId
  );

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#282828] bg-[#121212] shadow-2xl z-10 flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#282828] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm">
                <Laptop size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Connected Devices
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Manage devices signed into your Melody account
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Subheader / Global action */}
          <div className="flex items-center justify-between px-6 py-3 bg-zinc-950/60 border-b border-[#222222]">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Radio size={14} className="text-emerald-400 animate-pulse" />
              <span>
                {sessions.length} {sessions.length === 1 ? "active device" : "active devices"}
              </span>
            </div>

            {hasOtherSessions && (
              <button
                type="button"
                disabled={revokeOthersMutation.isPending}
                onClick={() => revokeOthersMutation.mutate()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all disabled:opacity-40 cursor-pointer"
              >
                {revokeOthersMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ShieldAlert size={13} />
                )}
                <span>Sign Out All Others</span>
              </button>
            )}
          </div>

          {/* Device Sessions List */}
          <div className="overflow-y-auto p-6 space-y-3 lyrics-scrollbar flex-1">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-[#282828] bg-zinc-900/40 animate-pulse flex items-center justify-between"
                  >
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-zinc-800 rounded" />
                      <div className="h-3 w-28 bg-zinc-800/70 rounded" />
                    </div>
                    <div className="h-8 w-16 bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/30 rounded-xl border border-dashed border-[#282828]">
                <Shield size={28} className="mx-auto text-zinc-500 mb-2" />
                <p className="text-sm font-medium text-white">No active sessions found</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Log in from a device to track active sessions here.
                </p>
              </div>
            ) : (
              sessions.map((session) => {
                const isThisDevice = session.isCurrent || session.deviceId === currentDeviceId;

                return (
                  <div
                    key={session.id}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                      isThisDevice
                        ? "bg-purple-950/15 border-purple-500/30 ring-1 ring-purple-500/10"
                        : "bg-zinc-900/40 border-[#282828] hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                          isThisDevice
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                        }`}
                      >
                        {isThisDevice ? <Laptop size={18} /> : <Smartphone size={18} />}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-zinc-200">
                            {session.deviceId
                              ? session.deviceId.length > 24
                                ? `${session.deviceId.slice(0, 10)}...${session.deviceId.slice(-6)}`
                                : session.deviceId
                              : "Device session"}
                          </span>

                          {isThisDevice && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              This device
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-zinc-500" />
                            Active: {formatDate(session.updatedAt || session.createdAt)}
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span>Expires: {formatDate(session.expiresAt)}</span>
                        </div>
                      </div>
                    </div>

                    {!isThisDevice ? (
                      <button
                        type="button"
                        title="Sign out device"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(session.id)}
                        className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all shrink-0 cursor-pointer disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <div className="shrink-0 text-emerald-400/80 p-1" title="Currently authenticated">
                        <CheckCircle2 size={18} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#282828] px-6 py-3.5 bg-black/40 flex justify-between items-center text-xs text-zinc-500">
            <span>Sessions automatically refresh every 7 days</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
