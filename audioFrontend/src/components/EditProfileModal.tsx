"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, X, Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { playerActions, playerStore } from "@/store/player.store";
import { useStore } from "@tanstack/react-store";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const [mounted, setMounted] = useState(false);
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (systemUser?.name) {
      setUserName(systemUser.name);
    }
  }, [systemUser?.name, isOpen]);

  const updateMutation = useMutation({
    mutationFn: (newName: string) => musicApi.users.updateProfile(newName),
    onSuccess: (res) => {
      const updated = res.data;
      if (updated) {
        playerActions.updateSystemUser({ name: updated.name || userName });
      } else {
        playerActions.updateSystemUser({ name: userName });
      }
      toast.success("Profile updated successfully!");
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update profile. Please try again.");
    },
  });

  if (!mounted || !isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      toast.error("Name cannot be blank");
      return;
    }
    updateMutation.mutate(userName.trim());
  };

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
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#282828] bg-[#121212] shadow-2xl z-10 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#282828] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <User size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Edit Profile
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update your display name across Melody
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-xl border border-[#282828] bg-black/60 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-white focus:outline-none transition-all"
                autoFocus
              />
            </div>

            {systemUser?.email && (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
                  Email (Read-only)
                </label>
                <input
                  type="text"
                  value={systemUser.email}
                  disabled
                  className="w-full rounded-xl border border-[#222222] bg-zinc-950/60 px-4 py-3 text-sm text-zinc-500 cursor-not-allowed"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!userName.trim() || updateMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40 cursor-pointer shadow-lg"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
