"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Toast, type ToastType } from "@/components/Toast";
import { PaginationBar } from "@/components/PaginationBar";
import { EditSongModal, type SongData } from "@/components/EditSongModal";
import { adminFetch } from "@/lib/adminFetch";
import type { Song } from "./types";
import { SongsFilterBar } from "./components/SongsFilterBar";
import { SongsGrid } from "./components/SongsGrid";
import { CreateSongModal } from "./components/CreateSongModal";

function SongsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalSongs, setTotalSongs] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<SongData | null>(null);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [togglingSongId, setTogglingSongId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type });
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch songs with pagination & optional search query
  const fetchSongs = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/admin/song?page=${page}&size=${pageSize}`;
      if (debouncedSearch.trim()) {
        url = `/api/search?q=${encodeURIComponent(debouncedSearch.trim())}`;
      }

      const res = await adminFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (debouncedSearch.trim()) {
          const searchSongs = data.songs || [];
          setSongs(searchSongs);
          setTotalSongs(searchSongs.length);
        } else {
          setSongs(data.content || []);
          setTotalSongs(data.paginationMetaData?.totalCount ?? data.totalElements ?? 0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch songs:", err);
      showToast("Unable to fetch songs from server", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, showToast]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // Handle URL query parameter `?edit=<id>`
  useEffect(() => {
    if (editId && songs.length > 0) {
      const target = songs.find((s) => s.id === editId);
      if (target) {
        setEditingSong(target as SongData);
      }
    }
  }, [editId, songs]);

  // Toggle Featured Hero status
  const handleToggleFeatured = async (song: Song) => {
    try {
      setTogglingSongId(song.id);
      const res = await adminFetch(`/admin/song/${song.id}/featured`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: !song.isFeatured }),
      });

      if (!res.ok) throw new Error("Failed to update featured status");

      setSongs((prev) =>
        prev.map((s) => (s.id === song.id ? { ...s, isFeatured: !s.isFeatured } : s)),
      );
      showToast(
        song.isFeatured ? "Removed from hero featured" : "Marked as hero featured",
        "success",
      );
    } catch (err) {
      console.error("Failed to toggle featured:", err);
      showToast("Could not update featured status", "error");
    } finally {
      setTogglingSongId(null);
    }
  };

  // Delete Track
  const handleDeleteSong = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This initiates a cascade purge across S3, CDN, and Algolia.`)) {
      return;
    }

    try {
      setDeletingSongId(id);
      const res = await adminFetch(`/admin/song/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete song");

      setSongs((prev) => prev.filter((s) => s.id !== id));
      setTotalSongs((prev) => Math.max(0, prev - 1));
      showToast(`Track "${title}" successfully queued for deletion`, "success");
    } catch (err) {
      console.error("Failed to delete song:", err);
      showToast("Could not delete song", "error");
    } finally {
      setDeletingSongId(null);
    }
  };

  const handleEditModalClose = () => {
    setEditingSong(null);
    if (editId) {
      router.replace("/songs");
    }
  };

  const handleEditModalSuccess = (updatedSong: SongData) => {
    setSongs((prev) =>
      prev.map((s) => (s.id === updatedSong.id ? { ...s, ...updatedSong } : s)),
    );
    showToast(`Track "${updatedSong.title}" updated successfully`, "success");
    handleEditModalClose();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header & Controls */}
      <SongsFilterBar
        search={search}
        onSearchChange={setSearch}
        totalSongs={totalSongs}
        pageSize={pageSize}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(0);
        }}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
      />

      {/* Songs Grid */}
      <SongsGrid
        songs={songs}
        loading={loading}
        togglingSongId={togglingSongId}
        deletingSongId={deletingSongId}
        onToggleFeatured={handleToggleFeatured}
        onEditSong={(song) => setEditingSong(song as SongData)}
        onDeleteSong={handleDeleteSong}
      />

      {/* Pagination Controls */}
      {totalSongs > 0 && (
        <div className="rounded-2xl overflow-hidden border border-[#282828]">
          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={totalSongs}
            currentCount={songs.length}
            itemLabel="tracks"
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(0);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            loading={loading}
          />
        </div>
      )}

      {/* Create Song Modal */}
      <CreateSongModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchSongs();
        }}
        showToast={showToast}
      />

      {/* Edit Song Modal */}
      <EditSongModal
        song={editingSong}
        isOpen={Boolean(editingSong)}
        onClose={handleEditModalClose}
        onSuccess={handleEditModalSuccess}
      />
    </div>
  );
}

export default function SongsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-zinc-500 text-sm">
          Loading track manager...
        </div>
      }
    >
      <SongsContent />
    </Suspense>
  );
}
