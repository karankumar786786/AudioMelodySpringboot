"use client";

import React, { use, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Music,
  Video,
  Trash2,
  Play,
  Pause,
  Film,
  Star,
  Search,
  Plus,
  Loader2,
  Clock,
  Radio,
  Edit3,
  X,
  Check,
} from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { getImageUrl } from "@/lib/image-utils";
import { useAudio } from "@/lib/audio-context";
import { uploadToImageKitWithProgress } from "@/lib/upload-utils";
import { Toast, type ToastType } from "@/components/Toast";
import type { Playlist, PlaylistSong } from "../types";

const formatDuration = (num?: number) => {
  if (!num || Number.isNaN(num)) return "0:00";
  const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatTotalRuntime = (songs: PlaylistSong[]) => {
  const totalSeconds = songs.reduce((acc, s) => {
    const d = s.duration || 0;
    const sec = d > 10000 ? Math.floor(d / 1000) : Math.floor(d);
    return acc + sec;
  }, 0);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hrs > 0) return `${hrs} hr ${mins} min`;
  return `${mins} min`;
};

export default function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentTrack, isPlaying, playTrack, pauseTrack, resumeTrack } = useAudio();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "FEATURED" | "CANVAS" | "FULL_VIDEO" | "LYRICS"
  >("ALL");

  // Operation states
  const [removingSongId, setRemovingSongId] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [removingVideo, setRemovingVideo] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });
  }, []);

  // 1. Fetch Playlist Details
  const fetchPlaylistDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch(`/admin/playlist/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data);
        setEditName(data.name || "");
        setEditDescription(data.description || "");
      } else {
        showToast("Playlist not found", "error");
      }
    } catch (err) {
      console.error("Failed to load playlist", err);
      showToast("Error loading playlist", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  // 2. Fetch Playlist Songs
  const fetchPlaylistSongs = useCallback(async () => {
    try {
      setLoadingSongs(true);
      const res = await adminFetch(`/admin/playlist/${id}/songs?page=0&size=500`);
      if (res.ok) {
        const data = await res.json();
        const content = data.content || data.data?.content || data.data || data || [];
        setSongs(Array.isArray(content) ? content : []);
      }
    } catch (err) {
      console.error("Failed to load playlist songs", err);
    } finally {
      setLoadingSongs(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPlaylistDetails();
    fetchPlaylistSongs();
  }, [fetchPlaylistDetails, fetchPlaylistSongs]);

  // 3. Audio preview playback
  const handlePlaySong = (song: PlaylistSong) => {
    if (currentTrack?.id === song.id) {
      if (isPlaying) {
        pauseTrack();
      } else {
        resumeTrack();
      }
    } else {
      playTrack({
        id: song.id,
        title: song.title,
        artistName: song.artistName || "Unknown Artist",
        songKey: song.songKey || `audios/${song.id}`,
        imageKey: song.imageKey,
        videoKey: song.videoKey || undefined,
        duration: song.duration,
      });
    }
  };

  // 4. Remove song from playlist
  const handleRemoveSong = async (songId: string, songTitle?: string) => {
    if (!playlist) return;
    try {
      setRemovingSongId(songId);
      const res = await adminFetch(`/admin/playlist/${playlist.id}/songs/${songId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSongs((prev) => prev.filter((s) => s.id !== songId));
        setPlaylist((prev) =>
          prev ? { ...prev, totalSongs: Math.max(0, prev.totalSongs - 1) } : null
        );
        showToast(`Removed "${songTitle || "track"}" from playlist`, "success");
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to remove track");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to remove track", "error");
    } finally {
      setRemovingSongId(null);
    }
  };

  // 5. Video teaser loop handlers
  const handleAttachVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !playlist) return;

    try {
      setUploadingVideo(true);
      const videoKey = await uploadToImageKitWithProgress(file, "/playlists/videos");
      const res = await adminFetch(`/admin/playlist/${playlist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoKey }),
      });

      if (res.ok) {
        const updated = { ...playlist, videoKey };
        setPlaylist(updated);
        showToast("Playlist teaser video loop updated!", "success");
      }
    } catch (err) {
      console.error("Video attachment failed:", err);
      showToast("Failed to upload teaser video", "error");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!playlist || !playlist.videoKey) return;
    try {
      setRemovingVideo(true);
      const res = await adminFetch(`/admin/playlist/${playlist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoKey: null }),
      });

      if (res.ok) {
        setPlaylist({ ...playlist, videoKey: undefined });
        showToast("Playlist teaser video removed", "success");
      }
    } catch (err) {
      console.error("Failed to remove video:", err);
      showToast("Error removing video", "error");
    } finally {
      setRemovingVideo(false);
    }
  };

  // 6. Update playlist metadata
  const handleSaveMetadata = async () => {
    if (!playlist || !editName.trim()) return;
    try {
      setSavingMetadata(true);
      const res = await adminFetch(`/admin/playlist/${playlist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      });

      if (res.ok) {
        setPlaylist({
          ...playlist,
          name: editName.trim(),
          description: editDescription.trim(),
        });
        setIsEditingMetadata(false);
        showToast("Playlist details updated", "success");
      } else {
        throw new Error("Update failed");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update playlist", "error");
    } finally {
      setSavingMetadata(false);
    }
  };

  // 7. Delete playlist
  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    if (
      !confirm(
        `Are you sure you want to delete playlist "${playlist.name}"? This action cannot be undone.`
      )
    )
      return;

    try {
      const res = await adminFetch(`/admin/playlist/${playlist.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast(`Playlist "${playlist.name}" deleted`, "success");
        router.push("/playlists");
      } else {
        throw new Error("Delete failed");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete playlist", "error");
    }
  };

  // Filter songs based on search and active filter chip
  const filteredSongs = useMemo(() => {
    let result = songs;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.artistName && s.artistName.toLowerCase().includes(q)) ||
          (s.genre && s.genre.toLowerCase().includes(q)) ||
          (s.album && s.album.toLowerCase().includes(q))
      );
    }

    if (activeFilter === "FEATURED") {
      result = result.filter((s) => s.isFeatured);
    } else if (activeFilter === "CANVAS") {
      result = result.filter((s) => Boolean(s.videoKey));
    } else if (activeFilter === "FULL_VIDEO") {
      result = result.filter((s) => Boolean(s.fullVideoKey));
    } else if (activeFilter === "LYRICS") {
      result = result.filter((s) => Boolean(s.lrclibId));
    }

    return result;
  }, [songs, search, activeFilter]);

  const totalStreams = useMemo(() => {
    return songs.reduce((acc, s) => acc + (s.totalStreams || 0), 0);
  }, [songs]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <span className="text-xs text-zinc-500 font-mono tracking-wider">
          LOADING PLAYLIST WORKSPACE...
        </span>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/8 flex items-center justify-center mx-auto text-zinc-500">
          <Music className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Playlist Not Found</h2>
        <p className="text-xs text-zinc-400">
          The requested playlist collection may have been removed or does not exist.
        </p>
        <Link
          href="/playlists"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Playlists</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8 text-white font-sans">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/playlists"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Playlists</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDeletePlaylist}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer"
            title="Delete this entire playlist"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Playlist</span>
          </button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#18181c] to-[#101013] border border-white/8 p-6 md:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          {/* Cover & Playlist Meta */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 min-w-0">
            {/* Cover Artwork */}
            <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden bg-black border border-white/10 shrink-0 shadow-2xl group">
              {playlist.coverImageKey ? (
                <img
                  src={getImageUrl(playlist.coverImageKey, {
                    width: 360,
                    height: 360,
                    focus: "auto",
                    aspectRatio: "1-1",
                  })}
                  alt={playlist.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900">
                  <Music className="w-12 h-12" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-3 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-zinc-300 border border-white/15">
                  Curated Playlist
                </span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs text-zinc-400 font-mono">
                  ID: {playlist.id.slice(0, 8)}...
                </span>
              </div>

              {!isEditingMetadata ? (
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
                      {playlist.name}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setIsEditingMetadata(true)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Edit playlist title and description"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs md:text-sm text-zinc-400 mt-2 max-w-2xl leading-relaxed">
                    {playlist.description || "No description provided."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pt-1 max-w-xl">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-black/60 border border-white/20 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-white"
                    placeholder="Playlist name..."
                  />
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-1.5 bg-black/60 border border-white/20 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-white resize-none"
                    placeholder="Playlist description..."
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveMetadata}
                      disabled={savingMetadata}
                      className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {savingMetadata ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditName(playlist.name);
                        setEditDescription(playlist.description);
                        setIsEditingMetadata(false);
                      }}
                      className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Stat Badges */}
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <strong className="text-white font-bold font-mono">
                    {songs.length}
                  </strong>{" "}
                  {songs.length === 1 ? "track" : "tracks"}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-mono text-zinc-300">
                    {formatTotalRuntime(songs)}
                  </span>
                </span>
                <span className="text-zinc-600">•</span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Play className="w-3 h-3 text-white fill-white" />
                  <span className="text-white font-bold">
                    {totalStreams.toLocaleString()}
                  </span>{" "}
                  streams
                </span>
              </div>
            </div>
          </div>

          {/* Teaser Video Controls */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-black/40 border border-white/8 space-y-3 min-w-[240px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-400 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-white" />
                  Teaser Video Loop
                </span>
                {playlist.videoKey ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/20">
                    Attached
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    None
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label
                  className={`flex-1 cursor-pointer bg-[#18181c] hover:bg-[#202026] border border-white/10 hover:border-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    uploadingVideo ? "opacity-75 cursor-wait" : ""
                  }`}
                >
                  {uploadingVideo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Video className="w-3.5 h-3.5 text-white" />
                      <span>{playlist.videoKey ? "Replace Video" : "Attach Loop"}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleAttachVideo}
                    disabled={uploadingVideo || removingVideo}
                    className="hidden"
                  />
                </label>

                {playlist.videoKey && (
                  <button
                    type="button"
                    onClick={handleRemoveVideo}
                    disabled={uploadingVideo || removingVideo}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    title="Remove attached teaser video"
                  >
                    {removingVideo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <Link
              href="/songs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Browse Catalog to Add (+)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tracks Workspace Section */}
      <div className="space-y-4">
        {/* Search & Faceted Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121215] p-3 rounded-2xl border border-white/8">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tracks by title, artist, genre, or album..."
              className="w-full bg-[#16161a] border border-white/8 hover:border-white/14 focus:border-white/30 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {/* Quick Filters */}
            <button
              type="button"
              onClick={() => setActiveFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === "ALL"
                  ? "bg-white text-black font-bold shadow-sm"
                  : "bg-[#16161a] text-zinc-400 hover:text-white border border-white/6"
              }`}
            >
              All ({songs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("FEATURED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                activeFilter === "FEATURED"
                  ? "bg-white text-black font-bold shadow-sm"
                  : "bg-[#16161a] text-zinc-400 hover:text-white border border-white/6"
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Featured</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("CANVAS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                activeFilter === "CANVAS"
                  ? "bg-white text-black font-bold shadow-sm"
                  : "bg-[#16161a] text-zinc-400 hover:text-white border border-white/6"
              }`}
            >
              <Film className="w-3.5 h-3.5 text-zinc-300" />
              <span>Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("FULL_VIDEO")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                activeFilter === "FULL_VIDEO"
                  ? "bg-white text-black font-bold shadow-sm"
                  : "bg-[#16161a] text-zinc-400 hover:text-white border border-white/6"
              }`}
            >
              <Video className="w-3.5 h-3.5 text-zinc-300" />
              <span>Full Video</span>
            </button>
          </div>
        </div>

        {/* Tracks Table */}
        <div className="bg-[#121215] border border-white/8 rounded-2xl overflow-hidden shadow-sm">
          {loadingSongs ? (
            <div className="p-16 text-center text-zinc-500 text-sm space-y-3">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-white" />
              <span>Loading collection tracks...</span>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="p-16 text-center text-zinc-500 text-sm space-y-3">
              <Music className="w-12 h-12 text-zinc-600 mx-auto" />
              <h4 className="text-white font-bold text-base">
                {songs.length === 0
                  ? "No tracks in this playlist yet"
                  : "No matching tracks found"}
              </h4>
              <p className="text-zinc-500 text-xs max-w-md mx-auto">
                {songs.length === 0
                  ? "Head over to the Songs Studio catalog and click the '+' button on any track to add it directly to this playlist."
                  : "Try clearing your search query or switching the filter filter."}
              </p>
              {songs.length === 0 && (
                <Link
                  href="/songs"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shadow-sm mt-2"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Go to Songs Catalog</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0e0e11] border-b border-white/8 text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">Track / Artist</th>
                    <th className="py-3.5 px-4">Genres</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Streams</th>
                    <th className="py-3.5 px-4">Assets</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {filteredSongs.map((song, index) => {
                    const isCurrentPlaying = currentTrack?.id === song.id && isPlaying;
                    const isRemoving = removingSongId === song.id;

                    const genreBadges = song.genre
                      ? song.genre
                          .split(",")
                          .map((g) => g.trim())
                          .filter(Boolean)
                      : [];

                    return (
                      <tr
                        key={song.id}
                        className="hover:bg-white/3 transition-colors group"
                      >
                        {/* Track Number */}
                        <td className="py-3 px-4 font-mono text-zinc-500 text-center text-xs">
                          {index + 1}
                        </td>

                        {/* Artwork + Title + Artist */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0 group/cover">
                              {song.imageKey ? (
                                <img
                                  src={getImageUrl(song.imageKey, {
                                    width: 80,
                                    height: 80,
                                  })}
                                  alt={song.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                  <Music className="w-4 h-4" />
                                </div>
                              )}

                              {/* Play / Pause overlay */}
                              <button
                                type="button"
                                onClick={() => handlePlaySong(song)}
                                className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity cursor-pointer ${
                                  isCurrentPlaying
                                    ? "opacity-100"
                                    : "opacity-0 group-hover/cover:opacity-100"
                                }`}
                              >
                                {isCurrentPlaying ? (
                                  <Pause className="w-4 h-4 text-white fill-white" />
                                ) : (
                                  <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
                                )}
                              </button>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-white group-hover:text-zinc-300 transition-colors truncate max-w-[260px]">
                                  {song.title}
                                </p>
                                {song.isFeatured && (
                                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate max-w-[260px]">
                                {song.artistName || "Unknown Artist"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Genres */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {genreBadges.length > 0 ? (
                              genreBadges.slice(0, 3).map((g) => (
                                <span
                                  key={g}
                                  className="px-2 py-0.5 rounded-md bg-white/6 text-zinc-300 border border-white/8 text-[10px] font-semibold"
                                >
                                  {g}
                                </span>
                              ))
                            ) : (
                              <span className="text-zinc-600 text-[11px]">—</span>
                            )}
                            {genreBadges.length > 3 && (
                              <span className="text-[10px] text-zinc-500 font-mono self-center">
                                +{genreBadges.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-4 font-mono text-zinc-400 tabular-nums">
                          {formatDuration(song.duration)}
                        </td>

                        {/* Streams */}
                        <td className="py-3 px-4 font-mono text-white tabular-nums">
                          {(song.totalStreams ?? 0).toLocaleString()}
                        </td>

                        {/* Assets */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {song.videoKey ? (
                              <span
                                className="p-1 rounded-md bg-white/10 text-white border border-white/20"
                                title="Vertical Video Canvas (9:16) attached"
                              >
                                <Film className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="p-1 text-zinc-600" title="No Canvas">
                                <Film className="w-3.5 h-3.5 opacity-30" />
                              </span>
                            )}

                            {song.fullVideoKey ? (
                              <span
                                className="p-1 rounded-md bg-white/10 text-white border border-white/20"
                                title="Full Video (16:9) attached"
                              >
                                <Video className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="p-1 text-zinc-600" title="No Full Video">
                                <Video className="w-3.5 h-3.5 opacity-30" />
                              </span>
                            )}

                            {song.lrclibId ? (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-zinc-200 border border-white/20"
                                title="Synced lyrics available"
                              >
                                LRC
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              song.status === "ACTIVE"
                                ? "bg-white/10 text-white border-white/20"
                                : "bg-zinc-800/40 text-zinc-400 border-zinc-700/40"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                song.status === "ACTIVE" ? "bg-white" : "bg-zinc-500"
                              }`}
                            />
                            {song.status || "ACTIVE"}
                          </span>
                        </td>

                        {/* Remove Action */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            disabled={isRemoving}
                            onClick={() => handleRemoveSong(song.id, song.title)}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Remove track from this playlist"
                          >
                            {isRemoving ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

