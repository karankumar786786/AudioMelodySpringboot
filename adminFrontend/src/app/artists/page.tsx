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
      const response = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/artists`);
      const result = await response.json();
      if (result.success) {
        setArtists(result.data.data || []);
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
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/artists/${id}`, { method: "DELETE" });
      if (res.ok) {
        setArtists(artists.filter(a => a.id !== id));
      } else {
        const data = await res.json();
        alert(data.message || "Delete failed");
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
      const sigResCover = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/misc/presigned-url/image`);
      if (!sigResCover.ok) throw new Error("Failed to get cover upload signature");
      const sigDataCover = await sigResCover.json();

      const formDataCover = new FormData();
      formDataCover.append("file", formData.coverImage);
      formDataCover.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "");
      formDataCover.append("signature", sigDataCover.data.signature);
      formDataCover.append("expire", sigDataCover.data.expire.toString());
      formDataCover.append("token", sigDataCover.data.token);
      formDataCover.append("folder", "/artists/covers");
      const extCover = formData.coverImage.name.split('.').pop();
      formDataCover.append("fileName", `${sigDataCover.data.tempKey}.${extCover}`);

      const uploadResCover = await adminFetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formDataCover,
      });
      const uploadDataCover = await uploadResCover.json();
      if (!uploadResCover.ok) throw new Error("Cover image upload failed");

      // 2. Upload Banner Image
      const sigResBanner = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/misc/presigned-url/image`);
      if (!sigResBanner.ok) throw new Error("Failed to get banner upload signature");
      const sigDataBanner = await sigResBanner.json();

      const formDataBanner = new FormData();
      formDataBanner.append("file", formData.bannerImage);
      formDataBanner.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "");
      formDataBanner.append("signature", sigDataBanner.data.signature);
      formDataBanner.append("expire", sigDataBanner.data.expire.toString());
      formDataBanner.append("token", sigDataBanner.data.token);
      formDataBanner.append("folder", "/artists/banners");
      const extBanner = formData.bannerImage.name.split('.').pop();
      formDataBanner.append("fileName", `${sigDataBanner.data.tempKey}.${extBanner}`);

      const uploadResBanner = await adminFetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formDataBanner,
      });
      const uploadDataBanner = await uploadResBanner.json();
      if (!uploadResBanner.ok) throw new Error("Banner image upload failed");

      // 3. Create Artist in Backend
      const createRes = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/artists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          about: formData.about,
          dob: formData.dob,
          coverImageKey: uploadDataCover.filePath,
          bannerImageKey: uploadDataBanner.filePath,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.message || "Backend failed to create artist");

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
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add New Artist
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-zinc-500">Loading artists...</div>
        ) : artists.length === 0 ? (
          <div className="col-span-full py-20 text-center text-zinc-500">No artists found.</div>
        ) : (
          artists.map((artist) => (
            <Link 
              key={artist.id} 
              href={`/artists/${artist.id}/songs`}
              className="group relative bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 block"
            >
              <div className="aspect-[4/5] bg-zinc-100 dark:bg-zinc-800 relative">
                {artist.coverImageKey ? (
                  <img 
                    src={getImageUrl(artist.coverImageKey, { width: 400, height: 500, focus: "face", aspectRatio: "4-5" })} 
                    alt={artist.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 italic">No Image</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                <div className="absolute bottom-0 p-6 w-full">
                  <h3 className="text-xl font-bold text-white mb-1">{artist.name}</h3>
                  <p className="text-zinc-300 text-xs line-clamp-2 leading-relaxed">{artist.about}</p>
                </div>
                
                {/* View Songs Indicator */}
                <div className="absolute top-4 left-4 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all border border-white/20">
                  View Songs
                </div>

                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(artist.id); }}
                  className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md text-white/80 hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100 z-10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </Link>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create Artist</h2>
              <button onClick={() => !uploading && setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 hover:rotate-90 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Artist Name</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Biography</label>
                  <textarea required value={formData.about} onChange={e => setFormData({...formData, about: e.target.value})} rows={3} className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Date of Birth</label>
                    <input required value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} type="date" className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Cover Image</label>
                    <input required type="file" accept="image/*" onChange={e => setFormData({...formData, coverImage: e.target.files?.[0] || null})} className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Banner Image</label>
                    <input required type="file" accept="image/*" onChange={e => setFormData({...formData, bannerImage: e.target.files?.[0] || null})} className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-600" />
                  </div>
                </div>
              </div>
              <button disabled={uploading} type="submit" className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-3 ${uploading ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"}`}>
                {uploading ? "Processing..." : "Create Artist Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
