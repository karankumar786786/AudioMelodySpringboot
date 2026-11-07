"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, X, UserPlus } from "lucide-react";
import { Toast, type ToastType } from "@/components/Toast";
import { PaginationBar } from "@/components/PaginationBar";
import { adminFetch } from "@/lib/adminFetch";
import { Artist } from "./types";
import { ArtistsGrid } from "./components/ArtistsGrid";
import { CreateArtistModal } from "./components/CreateArtistModal";

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalArtists, setTotalArtists] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

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

  const fetchArtists = useCallback(async () => {
    try {
      setLoading(true);
      const searchParam = debouncedSearch.trim()
        ? `&search=${encodeURIComponent(debouncedSearch.trim())}`
        : "";
      const response = await adminFetch(`/admin/artist?page=${page}&size=${pageSize}${searchParam}`);
      if (response.ok) {
        const result = await response.json();
        const content = result.content || result.data?.content || result.data || [];
        setArtists(content);
        const metaTotal = result.paginationMetaData?.totalCount ?? result.totalElements;
        if (metaTotal !== undefined && metaTotal !== null) {
          setTotalArtists(Number(metaTotal));
        } else if (content.length < pageSize) {
          setTotalArtists(page * pageSize + content.length);
        } else {
          setTotalArtists((page + 1) * pageSize);
        }
      } else {
        showToast("Failed to fetch artists", "error");
      }
    } catch (err) {
      console.error("Failed to fetch artists", err);
      showToast("Network error fetching artists", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, showToast]);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure? This will delete the artist and potentially affect associated songs.",
      )
    )
      return;
    try {
      const res = await adminFetch(`/admin/artist/${id}`, { method: "DELETE" });
      if (res.ok) {
        setArtists((prev) => prev.filter((a) => a.id !== id));
        setTotalArtists((prev) => Math.max(0, prev - 1));
        showToast("Artist deleted successfully", "success");
      } else {
        showToast("Delete failed", "error");
      }
    } catch (err: any) {
      showToast(
        err?.message || "Delete failed due to a network error",
        "error",
      );
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-400 mx-auto space-y-6 text-white font-sans">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121215] p-5 rounded-2xl border border-white/8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Artist Management
          </h1>
          <p className="text-zinc-400 mt-1 text-xs leading-relaxed">
            Manage artist profiles, discographies, cover artwork, and bios.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-65 sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search artists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-[#16161a] border border-white/8 hover:border-white/14 focus:border-white/30 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
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
            onClick={() => setIsModalOpen(true)}
            className="bg-white hover:bg-zinc-200 text-black px-4 py-2 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm text-xs shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Artist</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="space-y-6">
        <ArtistsGrid
          artists={artists}
          loading={loading}
          onDelete={handleDelete}
        />

        {/* Pagination Bar */}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalArtists}
          currentCount={artists.length}
          itemLabel="artists"
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(0);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          loading={loading}
        />
      </div>

      {/* Modal */}
      <CreateArtistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchArtists}
        showToast={showToast}
      />

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

