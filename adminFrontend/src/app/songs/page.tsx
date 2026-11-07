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
import { SongsDataTable } from "./components/SongsDataTable";
import { BulkActionsBar } from "./components/BulkActionsBar";
import { CreateSongModal } from "./components/CreateSongModal";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";

function SongsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isNewQuery = searchParams.get("new") === "true";

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalSongs, setTotalSongs] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(isNewQuery);
  const [editingSong, setEditingSong] = useState<SongData | null>(null);
  const [playlistSongTarget, setPlaylistSongTarget] = useState<Song | null>(null);
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
      const queryParts: string[] = [`page=${page}`, `size=${pageSize}`];

      // Combine text search with genre filter if active
      let effectiveSearch = debouncedSearch.trim();
      if (genreFilter !== "ALL") {
        effectiveSearch = effectiveSearch
          ? `${effectiveSearch} ${genreFilter}`
          : genreFilter;
      }

      if (effectiveSearch) {
        queryParts.push(`search=${encodeURIComponent(effectiveSearch)}`);
      }

      const url = `/admin/song?${queryParts.join("&")}`;
      const res = await adminFetch(url);
      if (res.ok) {
        const data = await res.json();
        const content = data.content || data.data?.content || data.data || [];
        setSongs(content);
        const metaTotal = data.paginationMetaData?.totalCount ?? data.totalElements;
        if (metaTotal !== undefined && metaTotal !== null) {
          setTotalSongs(Number(metaTotal));
        } else if (content.length < pageSize) {
          setTotalSongs(page * pageSize + content.length);
        } else {
          setTotalSongs((page + 1) * pageSize);
        }
      } else {
        showToast("Unable to fetch songs from server", "error");
      }
    } catch (err) {
      console.error("Failed to fetch songs:", err);
      showToast("Unable to fetch songs from server", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, genreFilter, showToast]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // Handle URL query parameter `?edit=<id>`
  useEffect(() => {
    if (editId) {
      const target = songs.find((s) => s.id === editId);
      if (target) {
        setEditingSong(target as SongData);
      } else {
        adminFetch(`/admin/song/${editId}`)
          .then(async (res) => {
            if (res.ok) {
              const song = await res.json();
              setEditingSong(song);
            }
          })
          .catch(() => {});
      }
    }
  }, [editId, songs]);

  // Multi-selection handlers
  const handleToggleSelectAll = () => {
    if (selectedSongIds.length === songs.length && songs.length > 0) {
      setSelectedSongIds([]);
    } else {
      setSelectedSongIds(songs.map((s) => s.id));
    }
  };

  const handleToggleSelectSong = (id: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

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
        prev.map((s) =>
          s.id === song.id ? { ...s, isFeatured: !s.isFeatured } : s
        )
      );
      showToast(
        song.isFeatured
          ? "Removed from hero featured"
          : "Marked as hero featured",
        "success"
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
    if (
      !confirm(
        `Are you sure you want to delete "${title}"? This initiates a cascade purge across S3, CDN, and Algolia.`
      )
    ) {
      return;
    }

    try {
      setDeletingSongId(id);
      const res = await adminFetch(`/admin/song/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete song");

      setSongs((prev) => prev.filter((s) => s.id !== id));
      setSelectedSongIds((prev) => prev.filter((item) => item !== id));
      setTotalSongs((prev) => Math.max(0, prev - 1));
      showToast(`Track "${title}" queued for deletion`, "success");
    } catch (err) {
      console.error("Failed to delete song:", err);
      showToast("Could not delete song", "error");
    } finally {
      setDeletingSongId(null);
    }
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedSongIds.length} selected tracks?`
      )
    ) {
      return;
    }

    try {
      setIsProcessingBulk(true);
      await Promise.all(
        selectedSongIds.map((id) =>
          adminFetch(`/admin/song/${id}`, { method: "DELETE" })
        )
      );
      setSongs((prev) => prev.filter((s) => !selectedSongIds.includes(s.id)));
      showToast(`Deleted ${selectedSongIds.length} tracks`, "success");
      setSelectedSongIds([]);
      fetchSongs();
    } catch (err) {
      console.error("Bulk delete error", err);
      showToast("Failed to delete some tracks", "error");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkSyncAlgolia = async () => {
    try {
      setIsProcessingBulk(true);
      showToast("Triggering search sync for selected tracks...", "info");
      // Call sync-metadata or batch index
      await adminFetch("/admin/jobs/sync-metadata", { method: "POST" });
      showToast("Search index synced successfully", "success");
      setSelectedSongIds([]);
    } catch (err) {
      console.error("Bulk Algolia sync error", err);
      showToast("Failed to sync search index", "error");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkSyncRecombee = async () => {
    try {
      setIsProcessingBulk(true);
      showToast("Triggering Recombee recommendation sync...", "info");
      await adminFetch("/admin/jobs/sync-metadata", { method: "POST" });
      showToast("Recombee catalog synced successfully", "success");
      setSelectedSongIds([]);
    } catch (err) {
      console.error("Bulk Recombee sync error", err);
      showToast("Failed to sync recommendations", "error");
    } finally {
      setIsProcessingBulk(false);
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
      prev.map((s) =>
        s.id === updatedSong.id ? { ...s, ...updatedSong } : s
      )
    );
    showToast(`Track "${updatedSong.title}" updated successfully`, "success");
    handleEditModalClose();
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6 text-white font-sans">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header & Filter Controls */}
      <SongsFilterBar
        search={search}
        onSearchChange={setSearch}
        genreFilter={genreFilter}
        onGenreFilterChange={(genre) => {
          setGenreFilter(genre);
          setPage(0);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalSongs={totalSongs}
        pageSize={pageSize}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(0);
        }}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
      />

      {/* Dual View Display: Spreadsheet Table vs Artwork Grid */}
      {viewMode === "table" ? (
        <SongsDataTable
          songs={songs}
          loading={loading}
          selectedSongIds={selectedSongIds}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelectSong={handleToggleSelectSong}
          togglingSongId={togglingSongId}
          deletingSongId={deletingSongId}
          onToggleFeatured={handleToggleFeatured}
          onEditSong={(song) => setEditingSong(song as SongData)}
          onDeleteSong={handleDeleteSong}
          onAddToPlaylist={(song) => setPlaylistSongTarget(song)}
        />
      ) : (
        <SongsGrid
          songs={songs}
          loading={loading}
          togglingSongId={togglingSongId}
          deletingSongId={deletingSongId}
          onToggleFeatured={handleToggleFeatured}
          onEditSong={(song) => setEditingSong(song as SongData)}
          onDeleteSong={handleDeleteSong}
          onAddToPlaylist={(song) => setPlaylistSongTarget(song)}
        />
      )}

      {/* Bulk Actions Floating Dock */}
      <BulkActionsBar
        selectedCount={selectedSongIds.length}
        onClearSelection={() => setSelectedSongIds([])}
        onBulkDelete={handleBulkDelete}
        onBulkSyncAlgolia={handleBulkSyncAlgolia}
        onBulkSyncRecombee={handleBulkSyncRecombee}
        isProcessing={isProcessingBulk}
      />

      {/* Pagination Controls */}
      {totalSongs > 0 && (
        <div className="rounded-2xl overflow-hidden border border-white/8 bg-[#121215]">
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

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        song={playlistSongTarget}
        isOpen={Boolean(playlistSongTarget)}
        onClose={() => setPlaylistSongTarget(null)}
        onSuccess={(playlistName) => {
          showToast(`Track added to playlist "${playlistName}"`, "success");
        }}
      />

      {/* Create Song Modal */}
      <CreateSongModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          if (isNewQuery) router.replace("/songs");
        }}
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
