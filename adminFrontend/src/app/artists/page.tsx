"use client";

import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/image-utils";
import Link from "next/link";
import { adminFetch } from "@/lib/adminFetch";

interface Artist {
  id: string;
  name: string;
  about: string;
  dob: string;
  coverImageKey: string;
  bannerImageKey: string;
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    about: "",
    dob: "",
    coverImage: null as File | null,
    bannerImage: null as File | null,
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
    if (!formData.bannerImage) return alert("Please select a banner image");

    setUploading(true);
    try {
      // 1. Upload Cover Image
      const sigResCover = await adminFetch("/webhook/internal/image-upload-param");
      if (!sigResCover.ok) throw new Error("Failed to get cover upload signature");
      const sigDataCover = await sigResCover.json();

      const formDataCover = new FormData();
      formDataCover.append("file", formData.coverImage);
      formDataCover.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_ck50bJ3UfF9eCOXhwXQTQFP693o=");
      formDataCover.append("signature", sigDataCover.param.signature);
      formDataCover.append("expire", sigDataCover.param.expire.toString());
      formDataCover.append("token", sigDataCover.param.token);
      formDataCover.append("folder", "/artists/covers");
      const extCover = formData.coverImage.name.split('.').pop();
      formDataCover.append("fileName", `${sigDataCover.key}.${extCover}`);

      const uploadResCover = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formDataCover,
      });
      const uploadDataCover = await uploadResCover.json();
      if (!uploadResCover.ok) throw new Error("Cover image upload failed");

      // 2. Upload Banner Image
      const sigResBanner = await adminFetch("/webhook/internal/image-upload-param");
      if (!sigResBanner.ok) throw new Error("Failed to get banner upload signature");
      const sigDataBanner = await sigResBanner.json();

      const formDataBanner = new FormData();
      formDataBanner.append("file", formData.bannerImage);
      formDataBanner.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_ck50bJ3UfF9eCOXhwXQTQFP693o=");
      formDataBanner.append("signature", sigDataBanner.param.signature);
      formDataBanner.append("expire", sigDataBanner.param.expire.toString());
      formDataBanner.append("token", sigDataBanner.param.token);
      formDataBanner.append("folder", "/artists/banners");
      const extBanner = formData.bannerImage.name.split('.').pop();
      formDataBanner.append("fileName", `${sigDataBanner.key}.${extBanner}`);

      const uploadResBanner = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formDataBanner,
      });
      const uploadDataBanner = await uploadResBanner.json();
      if (!uploadResBanner.ok) throw new Error("Banner image upload failed");

      // 3. Create Artist in Backend
      const createRes = await adminFetch("/admin/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          about: formData.about,
          coverImageKey: uploadDataCover.filePath || sigDataCover.key,
          bannerImageKey: uploadDataBanner.filePath || sigDataBanner.key,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        throw new Error(errData.message || "Failed to create artist");
      }

      setIsModalOpen(false);
      setFormData({ name: "", about: "", dob: "", coverImage: null, bannerImage: null });
      fetchArtists();
    } catch (err: any) {
      alert(err.message || "An unexpected error occurred");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Artist Management</h1>
          <p className="text-zinc-500 mt-1">Manage artist profiles and biographies.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-purple-500/20 transition-all active:scale-95 flex items-center gap-2"
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
          <div className="col-span-full p-20 text-center text-zinc-500 animate-pulse">Loading artists...</div>
        ) : artists.length === 0 ? (
          <div className="col-span-full p-20 text-center text-zinc-500">No artists found.</div>
        ) : (
          artists.map((artist) => (
            <div key={artist.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-xl transition-all group">
              <div className="h-32 bg-zinc-200 dark:bg-zinc-800 relative">
                {artist.bannerImageKey && (
                  <img 
                    src={getImageUrl(artist.bannerImageKey, { width: 600, height: 200, crop: "at_max" })} 
                    alt={artist.name} 
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute -bottom-10 left-6 w-20 h-20 rounded-2xl bg-white dark:bg-zinc-900 p-1 shadow-lg">
                  <div className="w-full h-full rounded-xl bg-zinc-300 dark:bg-zinc-800 overflow-hidden relative">
                    {artist.coverImageKey ? (
                      <img 
                        src={getImageUrl(artist.coverImageKey, { width: 100, height: 100, focus: "auto", aspectRatio: "1-1" })} 
                        alt={artist.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold">
                        {artist.name[0]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-14 p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{artist.name}</h3>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{artist.about || "No biography available."}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <span className="text-xs text-zinc-400 font-mono">ID: {artist.id.slice(0, 8)}...</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleDelete(artist.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Add New Artist</h2>
              <button onClick={() => !uploading && setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Artist Name</label>
                <input 
                  required 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Hans Zimmer"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Biography / About</label>
                <textarea 
                  rows={3}
                  value={formData.about}
                  onChange={e => setFormData({...formData, about: e.target.value})}
                  placeholder="Brief artist overview..."
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Cover Avatar</label>
                  <input 
                    required 
                    type="file" 
                    accept="image/*"
                    onChange={e => setFormData({...formData, coverImage: e.target.files?.[0] || null})}
                    className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Header Banner</label>
                  <input 
                    required 
                    type="file" 
                    accept="image/*"
                    onChange={e => setFormData({...formData, bannerImage: e.target.files?.[0] || null})}
                    className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600"
                  />
                </div>
              </div>

              <button 
                disabled={uploading}
                type="submit"
                className={`w-full py-4 mt-6 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-3 ${uploading ? "bg-purple-400" : "bg-purple-600 hover:bg-purple-700"}`}
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
