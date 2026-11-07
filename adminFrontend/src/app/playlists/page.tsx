"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ListMusic, Search, X } from "lucide-react";
import { Toast, type ToastType } from "@/components/Toast";
import { PaginationBar } from "@/components/PaginationBar";
import { adminFetch } from "@/lib/adminFetch";
import type { Playlist } from "./types";
import { PlaylistsGrid } from "./components/PlaylistsGrid";
import { CreatePlaylistModal } from "./components/CreatePlaylistModal";

export default function PlaylistsPage() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPlaylists, setTotalPlaylists] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
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

  const fetchPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      const searchParam = debouncedSearch.trim()
        ? `&search=${encodeURIComponent(debouncedSearch.trim())}`
        : "";
      const res = await adminFetch(`/admin/playlist?page=${page}&size=${pageSize}${searchParam}`);
      if (res.ok) {
        const data = await res.json();
        const content = data.content || data.data?.content || data.data || [];
        setPlaylists(content);
        const metaTotal = data.paginationMetaData?.totalCount ?? data.totalElements;
        if (metaTotal !== undefined && metaTotal !== null) {
          setTotalPlaylists(Number(metaTotal));
        } else if (content.length < pageSize) {
          setTotalPlaylists(page * pageSize + content.length);
        } else {
          setTotalPlaylists((page + 1) * pageSize);
        }
      }
    } catch (err) {
      console.error("Failed to fetch playlists:", err);
      showToast("Failed to load playlists", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, showToast]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const handleSelectPlaylist = (playlist: Playlist) => {
    router.push(`/playlists/${playlist.id}`);
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

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#121215] p-4 rounded-2xl border border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ListMusic className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Playlists Studio</h1>
            <p className="text-xs text-zinc-400">
              {playlists.length} of {totalPlaylists} {totalPlaylists === 1 ? "collection" : "collections"} curated
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-50 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search playlists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-black/60 border border-white/8 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-xl transition-all shadow-lg active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Playlist</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Playlists Grid */}
      <div className="space-y-4">
        <PlaylistsGrid
          playlists={playlists}
          loading={loading}
          deletingPlaylistId={deletingPlaylistId}
          onSelectPlaylist={handleSelectPlaylist}
          onDeletePlaylist={handleDeletePlaylist}
        />
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalPlaylists}
          currentCount={playlists.length}
          itemLabel="playlists"
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(0);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          loading={loading}
        />
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
