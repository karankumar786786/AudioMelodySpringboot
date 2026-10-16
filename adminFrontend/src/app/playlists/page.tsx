"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, ListMusic } from "lucide-react";
import { Toast, type ToastType } from "@/components/Toast";
import { adminFetch } from "@/lib/adminFetch";
import { uploadToImageKitWithProgress } from "@/lib/upload-utils";
import type { Playlist, PlaylistSong } from "./types";
import { PlaylistsGrid } from "./components/PlaylistsGrid";
import { CreatePlaylistModal } from "./components/CreatePlaylistModal";
import { PlaylistDetailDrawer } from "./components/PlaylistDetailDrawer";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<PlaylistSong[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [availableSongs, setAvailableSongs] = useState<PlaylistSong[]>([]);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null);
  const [addingSong, setAddingSong] = useState(false);
  const [removingSongId, setRemovingSongId] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [removingVideo, setRemovingVideo] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });
  }, []);

  const fetchPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/admin/playlist?page=0&size=100");
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.content || data.data?.content || data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch playlists:", err);
      showToast("Failed to load playlists", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchAvailableSongs = useCallback(async () => {
    try {
      const res = await adminFetch("/admin/song?page=0&size=500");
      if (res.ok) {
        const data = await res.json();
        const songsList = (data.content || data.data?.content || data.data || []).map(
          (s: any) => ({
            id: s.id,
            title: s.title,
          }),
        );
        setAvailableSongs(songsList);
      }
    } catch (err) {
      console.error("Failed to fetch available songs:", err);
    }
  }, []);

  const fetchPlaylistSongs = useCallback(async (playlistId: string) => {
    try {
      setLoadingSongs(true);
      const res = await adminFetch(`/admin/playlist/${playlistId}/songs`);
      if (res.ok) {
        const data = await res.json();
        const songs = (data.songs || data.content || data || []).map((s: any) => ({
          id: s.id,
          title: s.title,
        }));
        setPlaylistSongs(songs);
      }
    } catch (err) {
      console.error("Failed to fetch playlist songs:", err);
    } finally {
      setLoadingSongs(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
    fetchAvailableSongs();
  }, [fetchPlaylists, fetchAvailableSongs]);

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    fetchPlaylistSongs(playlist.id);
  };

  const handleDeletePlaylist = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete playlist "${name}"?`)) return;
    setDeletingPlaylistId(id);
    try {
      const res = await adminFetch(`/admin/playlist/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
        if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
        showToast(`Playlist "${name}" deleted successfully`, "success");
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Delete failed");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete playlist", "error");
    } finally {
      setDeletingPlaylistId(null);
    }
  };

  const handleAddSongToPlaylist = async (songId: string) => {
    if (!selectedPlaylist || !songId) return;
    const song = availableSongs.find((s) => s.id === songId);
    setAddingSong(true);
    try {
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      if (res.ok) {
        await fetchPlaylistSongs(selectedPlaylist.id);
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === selectedPlaylist.id ? { ...p, totalSongs: p.totalSongs + 1 } : p,
          ),
        );
        setSelectedPlaylist((prev) =>
          prev ? { ...prev, totalSongs: prev.totalSongs + 1 } : null,
        );
        showToast(`Added "${song?.title || "track"}" to playlist`, "success");
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to add song");
      }
    } catch (err: any) {
      showToast(err.message || "Error adding song to playlist", "error");
    } finally {
      setAddingSong(false);
    }
  };

  const handleRemoveSongFromPlaylist = async (songId: string, songTitle?: string) => {
    if (!selectedPlaylist) return;
    setRemovingSongId(songId);
    try {
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}/songs/${songId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlaylistSongs((prev) => prev.filter((s) => s.id !== songId));
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === selectedPlaylist.id
              ? { ...p, totalSongs: Math.max(0, p.totalSongs - 1) }
              : p,
          ),
        );
        setSelectedPlaylist((prev) =>
          prev ? { ...prev, totalSongs: Math.max(0, prev.totalSongs - 1) } : null,
        );
        showToast(`Removed "${songTitle || "track"}" from playlist`, "success");
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to remove song");
      }
    } catch (err: any) {
      showToast(err.message || "Error removing song", "error");
    } finally {
      setRemovingSongId(null);
    }
  };

  const handleAttachVideoToPlaylist = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlaylist) return;

    try {
      setUploadingVideo(true);
      const videoKey = await uploadToImageKitWithProgress(file, "/playlists/videos");
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoKey }),
      });

      if (res.ok) {
        const updated = { ...selectedPlaylist, videoKey };
        setSelectedPlaylist(updated);
        setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast("Playlist teaser video attached!", "success");
      }
    } catch (err) {
      console.error("Video attachment failed:", err);
      showToast("Failed to upload teaser video", "error");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleRemoveVideoFromPlaylist = async () => {
    if (!selectedPlaylist || !selectedPlaylist.videoKey) return;
    try {
      setRemovingVideo(true);
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoKey: null }),
      });

      if (res.ok) {
        const updated = { ...selectedPlaylist, videoKey: undefined };
        setSelectedPlaylist(updated);
        setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast("Playlist video removed", "success");
      }
    } catch (err) {
      console.error("Failed to remove video:", err);
      showToast("Error removing video", "error");
    } finally {
      setRemovingVideo(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#121212] p-4 rounded-2xl border border-[#282828]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <ListMusic className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Playlists</h1>
            <p className="text-xs text-zinc-400">
              {playlists.length} {playlists.length === 1 ? "collection" : "collections"} curated
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Playlists Grid (takes 1 col if detail drawer open, 3 cols if no detail) */}
        <div className={selectedPlaylist ? "lg:col-span-1" : "lg:col-span-3"}>
          <PlaylistsGrid
            playlists={playlists}
            loading={loading}
            deletingPlaylistId={deletingPlaylistId}
            selectedPlaylistId={selectedPlaylist?.id}
            onSelectPlaylist={handleSelectPlaylist}
            onDeletePlaylist={handleDeletePlaylist}
          />
        </div>

        {/* Selected Playlist Detail Drawer */}
        {selectedPlaylist && (
          <div className="lg:col-span-2">
            <PlaylistDetailDrawer
              playlist={selectedPlaylist}
              songs={playlistSongs}
              availableSongs={availableSongs}
              loadingSongs={loadingSongs}
              addingSong={addingSong}
              removingSongId={removingSongId}
              uploadingVideo={uploadingVideo}
              removingVideo={removingVideo}
              onClose={() => setSelectedPlaylist(null)}
              onAddSong={handleAddSongToPlaylist}
              onRemoveSong={handleRemoveSongFromPlaylist}
              onAttachVideo={handleAttachVideoToPlaylist}
              onRemoveVideo={handleRemoveVideoFromPlaylist}
            />
          </div>
        )}
      </div>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchPlaylists();
        }}
        showToast={showToast}
      />
    </div>
  );
}
