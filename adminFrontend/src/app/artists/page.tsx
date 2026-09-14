"use client";

import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/image-utils";
import Link from "next/link";
import { adminFetch } from "@/lib/adminFetch";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { uploadToImageKitWithProgress } from "@/lib/upload-utils";

interface Artist {
  id: string;
  name: string;
  about: string;
  dob: string;
  coverImageKey: string;
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploadStats, setUploadStats] = useState<{ loadedText?: string; speedText?: string }>({});

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    about: "",
    dob: "",
    coverImage: null as File | null,
  });

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
    if (!confirm("Are you sure? This will delete the artist and potentially affect associated songs.")) return;
    try {
      const res = await adminFetch(`/admin/artist/${id}`, { method: "DELETE" });
      if (res.ok) {
        setArtists(artists.filter(a => a.id !== id));
      } else {
        alert("Delete failed");
      }
    } catch (err) {
      alert("Delete failed due to a network error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.coverImage) return alert("Please select a cover image");

    setUploading(true);
    setUploadPercent(0);
    setUploadStats({});
    try {
      // 1. Upload Cover Image with real-time progress
      const uploadedImageKey = await uploadToImageKitWithProgress(
        formData.coverImage,
        "/artists/covers",
        (p) => {
          setUploadPercent(p.percent);
          setUploadStats({
            loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
            speedText: p.speedText,
          });
        }
      );

      // 2. Create Artist in Backend
      const createRes = await adminFetch("/admin/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          about: formData.about,
          coverImageKey: uploadedImageKey,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        throw new Error(errData.message || "Failed to create artist");
      }

      setIsModalOpen(false);
      setFormData({ name: "", about: "", dob: "", coverImage: null });
      fetchArtists();
    } catch (err: any) {
      alert(err.message || "An unexpected error occurred");
    } finally {
      setUploading(false);
      setUploadPercent(null);
      setUploadStats({});
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white">Artist Management</h1>
          <p className="text-zinc-400 mt-1">Manage artist profiles and biographies.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-white hover:bg-zinc-200 text-black px-6 py-3 rounded-full font-bold transition-all active:scale-95 flex items-center gap-2 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Artist
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#121212] rounded-3xl border border-[#282828] p-6 animate-pulse"
            >
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-5 w-32 bg-zinc-800 rounded-md" />
                  <div className="h-3 w-48 bg-zinc-800/60 rounded-md" />
                  <div className="h-3 w-24 bg-zinc-800/40 rounded-md" />
                </div>
              </div>
            </div>
          ))
        ) : artists.length === 0 ? (
          <div className="col-span-full p-20 text-center text-zinc-500 font-medium">No artists found.</div>
        ) : (
          artists.map((artist) => (
            <div key={artist.id} className="bg-[#121212] rounded-3xl border border-[#282828] overflow-hidden shadow-sm hover:border-zinc-600 transition-all group p-6">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-black/60 border border-[#282828] overflow-hidden shrink-0">
                  {artist.coverImageKey ? (
                    <img 
                      src={getImageUrl(artist.coverImageKey, { width: 150, height: 150, focus: "auto", aspectRatio: "1-1" })} 
                      alt={artist.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold text-xl">
                      {artist.name[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white truncate group-hover:text-zinc-200 transition-colors">{artist.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{artist.about || "No biography available."}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#282828] pt-4">
                <span className="text-xs text-zinc-500 font-mono">ID: {artist.id.slice(0, 8)}...</span>
                <div className="flex gap-2">
                  <Link
                    href={`/artists/${artist.id}/songs`}
                    className="px-4 py-1.5 rounded-full bg-black/60 border border-[#282828] text-xs font-bold text-zinc-300 hover:bg-white hover:text-black transition-all"
                  >
                    View Songs
                  </Link>
                  <button 
                    onClick={() => handleDelete(artist.id)}
                    className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Delete Artist"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121212] w-full max-w-xl rounded-3xl shadow-2xl border border-[#282828] overflow-hidden">
            <div className="p-6 border-b border-[#282828] flex justify-between items-center bg-black/40">
              <h2 className="text-lg font-bold text-white">Add New Artist</h2>
              <button 
                onClick={() => !uploading && setIsModalOpen(false)} 
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Artist Name</label>
                <input 
                  required 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Hans Zimmer"
                  className="w-full bg-black/60 border border-[#282828] rounded-xl p-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Biography / About</label>
                <textarea 
                  rows={3}
                  value={formData.about}
                  onChange={e => setFormData({...formData, about: e.target.value})}
                  placeholder="Brief artist overview..."
                  className="w-full bg-black/60 border border-[#282828] rounded-xl p-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Cover Avatar</label>
                <input 
                  required 
                  type="file" 
                  accept="image/*"
                  onChange={e => setFormData({...formData, coverImage: e.target.files?.[0] || null})}
                  className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-[#282828] file:text-xs file:font-semibold file:bg-black/60 file:text-zinc-200 hover:file:bg-white hover:file:text-black file:transition-all"
                />
              </div>

              {uploading && uploadPercent !== null && (
                <div className="mt-4">
                  <UploadProgressBar
                    percent={uploadPercent}
                    statusText="Uploading Artist Cover..."
                    fileName={formData.coverImage?.name}
                    loadedText={uploadStats.loadedText}
                    speedText={uploadStats.speedText}
                    variant="inline"
                  />
                </div>
              )}

              <button 
                disabled={uploading}
                type="submit"
                className={`w-full py-3.5 mt-6 rounded-full font-bold text-black flex items-center justify-center gap-3 transition-all ${uploading ? "bg-zinc-400 cursor-not-allowed" : "bg-white hover:bg-zinc-200 active:scale-[0.99]"}`}
              >
                {uploading ? "Creating Artist..." : "Save Artist"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
