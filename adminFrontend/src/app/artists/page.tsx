"use client";

import { useEffect, useState } from "react";
import { Toast, type ToastType } from "@/components/Toast";
import { adminFetch } from "@/lib/adminFetch";
import { Artist } from "./types";
import { ArtistsGrid } from "./components/ArtistsGrid";
import { CreateArtistModal } from "./components/CreateArtistModal";

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
  };

  const fetchArtists = async () => {
    try {
      setLoading(true);
      const response = await adminFetch("/admin/artist?page=0&size=100");
      if (response.ok) {
        const result = await response.json();
        setArtists(result.content || result.data?.content || result.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch artists", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtists();
  }, []);

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
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white">Artist Management</h1>
          <p className="text-zinc-400 mt-1">
            Manage artist profiles and biographies.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-white hover:bg-zinc-200 text-black px-6 py-3 rounded-full font-bold transition-all active:scale-95 flex items-center gap-2 shadow-sm"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Artist
        </button>
      </div>

      {/* Grid */}
      <ArtistsGrid
        artists={artists}
        loading={loading}
        onDelete={handleDelete}
      />

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
