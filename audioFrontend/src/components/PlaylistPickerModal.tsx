"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi, type Playlist } from "@/lib/api";
import { playerStore } from "@/store/player.store";
import { useStore } from "@tanstack/react-store";
import { motion, AnimatePresence } from "framer-motion";
import { ListMusic, X, Plus, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getImageUrl } from "@/lib/image-utils";

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
    mutationFn: (playlistId: string) =>
      musicApi.users.addSongToPlaylist(playlistId, songId),
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
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm bg-zinc-950 border  rounded-4xlshadow-[0_25px_80px_rgba(0,0,0,0.8)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b bg-white/4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                  <ListMusic size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-white italic uppercase tracking-tight leading-tight">
                    Add to Playlist
                  </h2>
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider truncate mt-0.5">
                    {songTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-600 hover:text-white hover:bg-white/5 rounded-xl transition-all shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[320px] overflow-y-auto lyrics-scrollbar p-4 space-y-2">
              {isCreating ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 p-2"
                >
                  <input
                    autoFocus
                    placeholder="Playlist name..."
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
                    className="w-full bg-zinc-900 border border-white/6 p-4 rounded-xl text-white text-sm font-bold outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all placeholder-zinc-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsCreating(false)}
                      className="flex-1 py-3 bg-zinc-900 text-zinc-500 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-zinc-800 transition-all"
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
                      className="flex-1 py-3 bg-primary text-black rounded-xl font-black text-[11px] uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/3 hover:bg-white/6 border  hover:border-primary/20 transition-all group"
                  >
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-black shadow group-hover:scale-105 transition-transform shrink-0">
                      <Plus size={18} />
                    </div>
                    <span className="text-sm font-bold text-white">
                      Create New Playlist
                    </span>
                  </button>

                  {/* Divider */}
                  {(playlists?.data?.data?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-3 py-2 px-1">
                      <div className="h-px flex-1 bg-white/4" />
                      <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">
                        Your Playlists
                      </span>
                      <div className="h-px flex-1 bg-white/4" />
                    </div>
                  )}

                  {/* Playlists List */}
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-14 bg-zinc-900/30 rounded-xl animate-pulse"
                        />
                      ))}
                    </div>
                  ) : (playlists?.data?.data?.length ?? 0) === 0 ? (
                    <div className="py-8 text-center text-zinc-700 font-bold italic text-xs">
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
                        className="w-full flex items-center justify-between p-3.5 rounded-xl  border border-transparent hover:bg-white/4 transition-all group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center text-zinc-700 group-hover:text-primary transition-colors shrink-0">
                            {playlist.coverImageKey ? (
                              <img
                                src={getImageUrl(playlist.coverImageKey, {
                                  width: 80,
                                  height: 80,
                                  focus: "auto",
                                  aspectRatio: "1-1",
                                })}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            ) : (
                              <ListMusic size={16} />
                            )}
                          </div>
                          <span className="text-sm font-bold text-zinc-300 group-hover:text-white truncate transition-colors">
                            {playlist.name}
                          </span>
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-zinc-800 group-hover:text-zinc-400 transition-colors shrink-0"
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
