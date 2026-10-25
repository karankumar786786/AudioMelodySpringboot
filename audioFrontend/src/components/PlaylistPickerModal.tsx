"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi, type PlaylistPrivacy } from "@/lib/api";
import { playerStore } from "@/store/player.store";
import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import {
  ListMusic,
  Plus,
  ChevronRight,
  Globe,
  Lock,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { PlaylistThumbnail } from "@/components/PlaylistThumbnail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BorderBeam } from "@/components/ui/border-beam";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [newPrivacy, setNewPrivacy] = useState<PlaylistPrivacy>("PRIVATE");

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsCreating(false);
      setNewName("");
      setNewPrivacy("PRIVATE");
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
        if (err?.response?.status === 409) {
          return { success: true, alreadyAdded: true };
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlist"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-songs"] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist"] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs"] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({ queryKey: ["home-playlists"] });
      if ((data as any)?.alreadyAdded) {
        toast.info(`"${songTitle}" is already in this playlist`);
      } else {
        toast.success(`Added "${songTitle}" to playlist`);
      }
      onClose();
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to add song to playlist"
      );
    },
  });

  const createAndAdd = useMutation({
    mutationFn: async () => {
      const res = await musicApi.users.createPlaylist(newName, newPrivacy);
      await musicApi.users.addSongToPlaylist(res.data.id, songId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlist"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-songs"] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist"] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs"] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({ queryKey: ["home-playlists"] });
      toast.success(`Created "${newName}" and added "${songTitle}"`);
      onClose();
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to create playlist"
      );
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-[#161616]/95 border-white/10 backdrop-blur-2xl p-0 overflow-hidden shadow-2xl">
        <BorderBeam size={160} duration={8} colorFrom="#ffffff" colorTo="#a1a1aa" />

        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-white/10 text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/15 text-primary rounded-xl shrink-0">
              <ListMusic size={20} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-white tracking-tight">
                Add to Playlist
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 truncate mt-0.5">
                {songTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="p-4 pt-2">
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
                <Input
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
                  className="bg-white/5 border-white/10 text-white placeholder-zinc-500 focus-visible:ring-primary/40"
                />
              </div>

              {/* Privacy Selector Pills */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Privacy
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: "PRIVATE" as const, label: "Private", icon: Lock },
                    { key: "SHARE_BY_LINK" as const, label: "Link Only", icon: Link2 },
                    { key: "PUBLIC" as const, label: "Public", icon: Globe },
                  ].map((p) => {
                    const Icon = p.icon;
                    const isSelected = newPrivacy === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setNewPrivacy(p.key)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary/20 border-primary text-white font-semibold"
                            : "bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/10"
                        }`}
                      >
                        <Icon size={12} className={isSelected ? "text-primary" : ""} />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 rounded-full text-xs"
                >
                  Cancel
                </Button>
                <Button
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
                  className="flex-1 rounded-full text-xs font-bold"
                >
                  {createAndAdd.isPending ? "Creating..." : "Create & Add"}
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {/* Create New Button */}
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer group"
              >
                <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-black shadow group-hover:scale-105 transition-transform shrink-0">
                  <Plus size={18} />
                </div>
                <span className="text-sm font-semibold text-white">
                  New Playlist
                </span>
              </button>

              {/* Divider */}
              {(() => {
                const ownedPlaylists = (playlists?.data?.data || []).filter((p: any) => {
                  const oId = p.ownerId || p.userId;
                  return !oId || (systemUser?.id && oId === systemUser.id);
                });

                return (
                  <>
                    {ownedPlaylists.length > 0 && (
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Your Playlists
                        </span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                    )}

                    <ScrollArea className="max-h-64 pr-2">
                      {isLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full rounded-lg" />
                          ))}
                        </div>
                      ) : ownedPlaylists.length === 0 ? (
                        <div className="py-6 text-center text-zinc-400 font-medium text-xs">
                          No owned playlists found
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {ownedPlaylists.map((playlist: any) => (
                            <button
                              key={playlist.id}
                              type="button"
                              onClick={() => {
                                toast.promise(
                                  addToPlaylist.mutateAsync(playlist.id),
                                  {
                                    loading: "Adding to Playlist...",
                                    success: "Added to Playlist",
                                    error: "Failed to add to playlist",
                                    description: `"${songTitle}" added to ${playlist.name}.`,
                                  }
                                );
                              }}
                              disabled={addToPlaylist.isPending}
                              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/10 transition-colors group disabled:opacity-50 cursor-pointer"
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
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
