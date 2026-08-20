"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi, type Playlist } from "@/lib/api";
import { playerStore } from "@/store/player.store";
import { useStore } from "@tanstack/react-store";
import { motion, AnimatePresence } from "framer-motion";
import { ListMusic, X, Plus, ChevronRight, Music } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { PlaylistThumbnail } from "@/components/PlaylistThumbnail";

interface PlaylistPickerModalProps {
  songId: string;
  songTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PlaylistPickerModal({
  songId,
  songTitle,
  isOpen,
  onClose,
}: PlaylistPickerModalProps) {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsCreating(false);
      setNewName("");
    }
  }, [isOpen]);

  const { data: playlists, isLoading } = useQuery({
    queryKey: ["user-playlists", systemUser?.id],
    queryFn: () => musicApi.users.getPlaylists(),
    enabled: !!systemUser?.id && isOpen,
  });

  const addToPlaylist = useMutation({
    mutationFn: async (playlistId: string) => {
      try {
        return await musicApi.users.addSongToPlaylist(playlistId, songId);
      } catch (err: any) {
        // 409 = song already in playlist — treat as success (idempotent)
        if (err?.response?.status === 409) {
          return { success: true, alreadyAdded: true };
        }
        throw err;
      }
    },
    onSuccess: () => {
      onClose();
    },
  });

  const createAndAdd = useMutation({
    mutationFn: async () => {
      const res = await musicApi.users.createPlaylist(newName);
      await musicApi.users.addSongToPlaylist(res.data.id, songId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      onClose();
    },
  });

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-200 flex items-center justify-center p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm bg-[#181818] border border-[#282828] rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 pb-4 border-b border-[#282828] flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0">
                  <ListMusic size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Add to Playlist
                  </h2>
                  <p className="text-xs text-zinc-400 truncate mt-0.5 font-normal">
                    {songTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#282828] rounded-full transition-colors shrink-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-80 overflow-y-auto lyrics-scrollbar p-4 space-y-2">
              {isCreating ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 p-1"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Playlist Name
                    </label>
                    <input
                      autoFocus
                      placeholder="My Playlist #1"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newName.trim()) {
                          toast.promise(createAndAdd.mutateAsync(), {
                            loading: "Creating Playlist...",
                            success: (playlist) =>
                              `Playlist "${playlist.name}" Created`,
                            error: "Failed to create playlist",
                            description: (playlist: any) =>
                              playlist?.name
                                ? `Created "${playlist.name}" and added "${songTitle}".`
                                : "Failed to create new playlist.",
                          });
                        }
                        if (e.key === "Escape") setIsCreating(false);
                      }}
                      className="w-full bg-[#282828] border border-[#383838] px-4 py-2.5 rounded-md text-white text-sm outline-none focus:border-primary transition-colors placeholder-zinc-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => setIsCreating(false)}
                      className="flex-1 py-2.5 bg-[#282828] text-zinc-300 rounded-full font-semibold text-xs hover:bg-[#333333] transition-colors cursor-pointer border border-[#383838]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (newName.trim()) {
                          toast.promise(createAndAdd.mutateAsync(), {
                            loading: "Creating Playlist...",
                            success: (playlist) =>
                              `Playlist "${playlist.name}" Created`,
                            error: "Failed to create playlist",
                            description: (playlist: any) =>
                              playlist?.name
                                ? `Created "${playlist.name}" and added "${songTitle}".`
                                : "Failed to create new playlist.",
                          });
                        }
                      }}
                      disabled={!newName.trim() || createAndAdd.isPending}
                      className="flex-1 py-2.5 bg-primary text-black rounded-full font-bold text-xs hover:scale-105 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {createAndAdd.isPending ? "Creating..." : "Create & Add"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* Create New Button */}
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-md bg-[#282828] hover:bg-[#333333] border border-[#383838] transition-colors cursor-pointer group"
                  >
                    <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center text-black shadow group-hover:scale-105 transition-transform shrink-0">
                      <Plus size={18} />
                    </div>
                    <span className="text-sm font-semibold text-white">
                      New Playlist
                    </span>
                  </button>

                  {/* Divider */}
                  {(playlists?.data?.data?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-3 py-2 px-1">
                      <div className="h-px flex-1 bg-[#282828]" />
                      <span className="text-xs font-semibold text-zinc-400">
                        Your Playlists
                      </span>
                      <div className="h-px flex-1 bg-[#282828]" />
                    </div>
                  )}

                  {/* Playlists List */}
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-12 bg-zinc-900 rounded-md animate-pulse"
                        />
                      ))}
                    </div>
                  ) : (playlists?.data?.data?.length ?? 0) === 0 ? (
                    <div className="py-6 text-center text-zinc-400 font-medium text-xs">
                      No playlists found
                    </div>
                  ) : (
                    playlists?.data?.data.map((playlist: Playlist) => (
                      <button
                        key={playlist.id}
                        onClick={() => {
                          toast.promise(
                            addToPlaylist.mutateAsync(playlist.id),
                            {
                              loading: "Adding to Playlist...",
                              success: "Added to Playlist",
                              error: "Failed to add to playlist",
                              description: `"${songTitle}" added to ${playlist.name}.`,
                            },
                          );
                        }}
                        disabled={addToPlaylist.isPending}
                        className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-[#282828] transition-colors group disabled:opacity-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <PlaylistThumbnail playlist={playlist} size={36} />
                          <span className="text-sm font-semibold text-zinc-200 group-hover:text-white truncate transition-colors">
                            {playlist.name}
                          </span>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0"
                        />
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Use portal to render at document.body level, breaking out of any transform context
  return createPortal(modalContent, document.body);
}
