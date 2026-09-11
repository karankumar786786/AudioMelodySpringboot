"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2,
  Copy,
  Check,
  Globe,
  Lock,
  Link2,
  X,
  ExternalLink,
  Sparkles,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi, type PlaylistPrivacy, type UserPlaylist } from "@/lib/api";

interface PlaylistShareModalProps {
  playlist: UserPlaylist;
  isOpen: boolean;
  onClose: () => void;
  isOwner?: boolean;
}

export function PlaylistShareModal({
  playlist,
  isOpen,
  onClose,
  isOwner = true,
}: PlaylistShareModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  const [currentPrivacy, setCurrentPrivacy] = useState<PlaylistPrivacy>(
    playlist.privacy || "PRIVATE"
  );

  useEffect(() => {
    if (playlist.privacy) {
      setCurrentPrivacy(playlist.privacy);
    }
  }, [playlist.privacy, playlist.id]);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://audiomelody.com";

  const shareTokenOrId = playlist.shareToken || playlist.id;
  const shareUrl = `${origin}/playlists/shared/${shareTokenOrId}`;

  const updatePrivacyMutation = useMutation({
    mutationFn: async (newPrivacy: PlaylistPrivacy) => {
      setCurrentPrivacy(newPrivacy);
      return await musicApi.users.updatePrivacy(playlist.id, newPrivacy);
    },
    onSuccess: (data, newPrivacy) => {
      queryClient.invalidateQueries({ queryKey: ["user-playlist", playlist.id] });
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["shared-playlist", shareTokenOrId] });

      const label =
        newPrivacy === "PUBLIC"
          ? "Public (Discoverable by everyone)"
          : newPrivacy === "SHARE_BY_LINK"
          ? "Share by link (Unlisted)"
          : "Private (Only you)";

      toast.success("Privacy Updated", {
        description: `Playlist is now ${label}.`,
      });
    },
    onError: () => {
      setCurrentPrivacy(playlist.privacy || "PRIVATE");
      toast.error("Failed to update privacy");
    },
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!", {
        description: "Anyone with this link can view and stream this playlist.",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${playlist.name} - AudioMelody Playlist`,
          text: `Check out this playlist "${playlist.name}" on AudioMelody!`,
          url: shareUrl,
        });
      } catch (err) {
        // Ignored if user dismissed share dialog
      }
    } else {
      handleCopyLink();
    }
  };

  const privacyOptions: {
    key: PlaylistPrivacy;
    label: string;
    description: string;
    icon: typeof Globe;
    color: string;
    activeBg: string;
    badgeBg: string;
  }[] = [
    {
      key: "PUBLIC",
      label: "Public",
      description: "Anyone can discover, search, and listen to this playlist.",
      icon: Globe,
      color: "text-emerald-400",
      activeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
      badgeBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    {
      key: "SHARE_BY_LINK",
      label: "Share by link",
      description: "Unlisted. Only people with the direct share link can listen.",
      icon: Link2,
      color: "text-blue-400",
      activeBg: "bg-blue-500/10 border-blue-500/30 text-blue-300",
      badgeBg: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    {
      key: "PRIVATE",
      label: "Private",
      description: "Only you can see and listen to this playlist.",
      icon: Lock,
      color: "text-amber-400",
      activeBg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
      badgeBg: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
  ];

  if (!isOpen || !mounted) return null;

  const isCurrentlyPrivate = currentPrivacy === "PRIVATE";

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-200 flex items-center justify-center p-4 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="relative w-full max-w-lg bg-[#141414] border border-[#282828] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 pb-4 border-b border-[#242424] flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0 border border-primary/20">
                  <Share2 size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    Share Playlist
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                      <Sparkles size={11} className="text-primary" /> Premium
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {playlist.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors shrink-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="overflow-y-auto p-5 space-y-5 lyrics-scrollbar">
              {/* Privacy Warning Alert if currently Private */}
              {isCurrentlyPrivate && isOwner && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3.5 flex items-start justify-between gap-3 text-amber-200"
                >
                  <div className="flex items-start gap-2.5">
                    <Lock size={16} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-300">
                        This playlist is currently Private
                      </p>
                      <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                        Friends opening this link won't be able to stream tracks until you enable sharing.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePrivacyMutation.mutate("SHARE_BY_LINK")}
                    disabled={updatePrivacyMutation.isPending}
                    className="shrink-0 px-3 py-1 bg-amber-400 text-black text-xs font-bold rounded-lg hover:bg-amber-300 transition-colors shadow-sm cursor-pointer"
                  >
                    Make Shareable
                  </button>
                </motion.div>
              )}

              {/* Privacy Selector (Only for playlist owner) */}
              {isOwner && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Privacy & Access
                    </label>
                    <span className="text-[11px] text-zinc-500">
                      Select who can listen
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {privacyOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = currentPrivacy === opt.key;

                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            if (!isSelected) {
                              updatePrivacyMutation.mutate(opt.key);
                            }
                          }}
                          disabled={updatePrivacyMutation.isPending}
                          className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? `${opt.activeBg} ring-1 ring-white/10 shadow-md`
                              : "bg-[#1c1c1c] border-[#2b2b2b] text-zinc-400 hover:bg-[#242424] hover:border-[#383838]"
                          }`}
                        >
                          <div
                            className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                              isSelected
                                ? "bg-white/10 " + opt.color
                                : "bg-zinc-800 text-zinc-500"
                            }`}
                          >
                            <Icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-xs font-bold ${
                                  isSelected ? "text-white" : "text-zinc-300"
                                }`}
                              >
                                {opt.label}
                              </span>
                              {isSelected && (
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${opt.badgeBg}`}
                                >
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                              {opt.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shareable Link Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>Shareable Link</span>
                  {currentPrivacy === "SHARE_BY_LINK" && (
                    <span className="text-[11px] font-medium text-blue-400">
                      Unlisted Link Active
                    </span>
                  )}
                </label>

                <div className="flex items-center gap-2 p-1.5 pl-3.5 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl focus-within:border-primary transition-colors">
                  <Link2 size={16} className="text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full bg-transparent text-xs text-zinc-200 outline-none select-all truncate font-mono"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm ${
                      copied
                        ? "bg-emerald-500 text-black scale-105"
                        : "bg-primary text-black hover:bg-primary/90 hover:scale-[1.02]"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={14} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Social Share Buttons */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Share Via
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* WhatsApp */}
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `🎵 Listen to my playlist "${playlist.name}" on AudioMelody:\n${shareUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-[#1c1c1c] border border-[#2b2b2b] text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-[#222222] transition-all cursor-pointer"
                  >
                    <MessageCircle size={18} className="text-emerald-400" />
                    <span className="text-[11px] font-semibold">WhatsApp</span>
                  </a>

                  {/* Twitter / X */}
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      `🎶 Listening to "${playlist.name}" playlist on AudioMelody:`
                    )}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-[#1c1c1c] border border-[#2b2b2b] text-zinc-300 hover:text-sky-400 hover:border-sky-500/40 hover:bg-[#222222] transition-all cursor-pointer"
                  >
                    <svg className="w-[18px] h-[18px] fill-current text-sky-400" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span className="text-[11px] font-semibold">Twitter (X)</span>
                  </a>

                  {/* Telegram */}
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(
                      shareUrl
                    )}&text=${encodeURIComponent(
                      `🎵 Check out "${playlist.name}" on AudioMelody!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-[#1c1c1c] border border-[#2b2b2b] text-zinc-300 hover:text-blue-400 hover:border-blue-500/40 hover:bg-[#222222] transition-all cursor-pointer"
                  >
                    <Send size={18} className="text-blue-400" />
                    <span className="text-[11px] font-semibold">Telegram</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#101010] border-t border-[#222222] flex items-center justify-between text-xs text-zinc-500">
              <span className="truncate">
                {currentPrivacy === "PUBLIC" && "Public: Discoverable everywhere"}
                {currentPrivacy === "SHARE_BY_LINK" && "Share by Link: Direct access only"}
                {currentPrivacy === "PRIVATE" && "Private: Only creator can access"}
              </span>
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex items-center gap-1 text-primary hover:underline font-semibold cursor-pointer shrink-0 ml-2"
              >
                More options <ExternalLink size={12} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
