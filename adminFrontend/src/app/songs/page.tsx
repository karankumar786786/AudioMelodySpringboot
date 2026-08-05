"use client";

import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/image-utils";
import { adminFetch } from "@/lib/adminFetch";

interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  language: string;
  imageKey: string;
  createdAt: string;
}

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [uploadMode, setUploadMode] = useState<"file" | "youtube">("file");
  const [formData, setFormData] = useState({
    title: "",
    artistName: "",
    songFile: null as File | null,
    imageFile: null as File | null,
    ytUrl: "",
  });
  const [uploading, setUploading] = useState(false);
  const [fetchingYt, setFetchingYt] = useState(false);

  const fetchSongs = async () => {
    try {
      const response = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/songs`);
      const result = await response.json();
      if (result.success) {
        setSongs(result.data.items || result.data.data || []);
      }
    } catch (err) {
      setError("Failed to fetch songs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this song?")) return;
    try {
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/songs/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSongs(songs.filter(s => s.id !== id));
      }
    } catch (err) {
      alert("Failed to delete song");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMode === "file" && (!formData.songFile || !formData.imageFile)) {
      return alert("Please select both audio and image files");
    }
    if (uploadMode === "youtube" && !formData.ytUrl) {
      return alert("Please enter a YouTube URL");
    }

    setUploading(true);
    try {
      if (uploadMode === "youtube") {
        const finalizeRes = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/songs/youtube`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            artistName: formData.artistName,
            ytUrl: formData.ytUrl,
          }),
        });

        const finalData = await finalizeRes.json();
        if (finalData.success) {
          setIsModalOpen(false);
          setFormData({ title: "", artistName: "", songFile: null, imageFile: null, ytUrl: "" });
          fetchSongs();
        } else {
          throw new Error(finalData.message);
        }
        return;
      }
      // 1. Get Pre-signed URLs
      const [songUrlRes, imageUrlRes] = await Promise.all([
        adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/misc/presigned-url/song`),
        adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/misc/presigned-url/image`),
      ]);

      const songUrlData = await songUrlRes.json();
      const imageUrlData = await imageUrlRes.json();

      if (!songUrlData.success || !imageUrlData.success) throw new Error("Failed to get upload URLs");

      if (!formData.songFile || !formData.imageFile) throw new Error("Missing files");

      // 2. Upload Files
      // S3 Upload for Song
      await adminFetch(songUrlData.data.url, {
        method: "PUT",
        body: formData.songFile,
        headers: { "Content-Type": formData.songFile.type },
      });

      // Simple upload logic for ImageKit (assuming direct upload with signature)
      const imageFormData = new FormData();
      imageFormData.append("file", formData.imageFile);
      imageFormData.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "");
      imageFormData.append("signature", imageUrlData.data.signature);
      imageFormData.append("expire", imageUrlData.data.expire.toString());
      imageFormData.append("token", imageUrlData.data.token);
      imageFormData.append("folder", "/songs/images");
      const extension = formData.imageFile.name.split('.').pop();
      const fileNameWithExt = `${imageUrlData.data.tempKey}.${extension}`;

      imageFormData.append("fileName", fileNameWithExt);

      const ikRes = await adminFetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: imageFormData,
      });
      const ikData = await ikRes.json();
      if (!ikRes.ok) throw new Error(ikData.message || "ImageKit upload failed");

      // 3. Finalize in Backend
      const finalizeRes = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          artistName: formData.artistName,
          tempSongKey: songUrlData.data.key,
          imageKey: ikData.filePath,
        }),
      });

      const finalData = await finalizeRes.json();
      if (finalData.success) {
        setIsModalOpen(false);
        setFormData({ title: "", artistName: "", songFile: null, imageFile: null, ytUrl: "" });
        fetchSongs();
      } else {
        throw new Error(finalData.message);
      }
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const fetchYtInfo = async () => {
    if (!formData.ytUrl) return;
    setFetchingYt(true);
    try {
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/misc/yt-info?url=${encodeURIComponent(formData.ytUrl)}`);
      const data = await res.json();
      if (data.success && data.data?.title) {
        setFormData({ ...formData, title: data.data.title });
      } else {
        alert("Could not fetch YouTube info");
      }
    } catch {
      alert("Error fetching YouTube info");
    } finally {
      setFetchingYt(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Song Library</h1>
          <p className="text-zinc-500 mt-1">Total {songs.length} tracks available in the system.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Song
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50">
              <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-zinc-500">Track Detail</th>
              <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-zinc-500">Artist</th>
              <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-zinc-500">Language</th>
              <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-zinc-500">Duration</th>
              <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={5} className="p-20 text-center text-zinc-500 animate-pulse">Loading library...</td></tr>
            ) : songs.length === 0 ? (
              <tr><td colSpan={5} className="p-20 text-center text-zinc-500">No tracks found.</td></tr>
            ) : (
              songs.map((song) => (
                <tr key={song.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-800 shadow-lg shadow-indigo-500/10 flex items-center justify-center text-white shrink-0 overflow-hidden">
                        {song.imageKey ? (
                          <img 
                            src={getImageUrl(song.imageKey, { width: 100, height: 100, focus: "auto", aspectRatio: "1-1" })} 
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-6 h-6 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9 14l5-4-5-4v8z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">{song.title}</span>
                        <span className="text-xs text-zinc-500 mt-0.5">ID: {song.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-zinc-600 dark:text-zinc-400 font-medium">{song.artistName}</td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold">{song.language}</span>
                  </td>
                  <td className="px-8 py-5 text-zinc-500 font-mono">
                    {(() => {
                      const durationInSeconds = Math.floor(song.duration / 1000);
                      const mins = Math.floor(durationInSeconds / 60);
                      const secs = durationInSeconds % 60;
                      return `${mins}:${secs.toString().padStart(2, '0')}`;
                    })()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => handleDelete(song.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Add New Song</h2>
              <button onClick={() => !uploading && setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 hover:rotate-90 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleUpload} className="p-8 space-y-6">
              {/* Tabs */}
              <div className="flex gap-4 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                <button
                  type="button"
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${uploadMode === 'file' ? 'bg-white dark:bg-zinc-700 text-indigo-600 shadow-sm' : 'text-zinc-500'}`}
                  onClick={() => setUploadMode('file')}
                >
                  Direct Upload
                </button>
                <button
                  type="button"
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${uploadMode === 'youtube' ? 'bg-white dark:bg-zinc-700 text-red-600 shadow-sm' : 'text-zinc-500'}`}
                  onClick={() => setUploadMode('youtube')}
                >
                  Import from YouTube
                </button>
              </div>

              <div className="space-y-4">
                {uploadMode === "youtube" && (
                  <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20">
                    <label className="block text-sm font-bold text-red-700 dark:text-red-300 mb-2 uppercase tracking-wider">YouTube URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        value={formData.ytUrl}
                        onChange={e => setFormData({...formData, ytUrl: e.target.value})}
                        placeholder="https://youtube.com/..."
                        className="flex-1 bg-white dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-red-500 transition-all text-sm"
                        required={uploadMode === "youtube"}
                      />
                      <button 
                        type="button"
                        onClick={fetchYtInfo}
                        disabled={fetchingYt || !formData.ytUrl}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 rounded-xl text-sm font-bold transition-all"
                      >
                        {fetchingYt ? "Fetching..." : "Get Info"}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Song Title</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g. Moonlight Sonata"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Artist Name</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.artistName}
                    onChange={e => setFormData({...formData, artistName: e.target.value})}
                    placeholder="e.g. Beethoven"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {uploadMode === "file" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Audio File</label>
                      <input 
                        required={uploadMode === "file"} 
                        type="file" 
                        accept="audio/*"
                        onChange={e => setFormData({...formData, songFile: e.target.files?.[0] || null})}
                        className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Cover Image</label>
                      <input 
                        required={uploadMode === "file"} 
                        type="file" 
                        accept="image/*"
                        onChange={e => setFormData({...formData, imageFile: e.target.files?.[0] || null})}
                        className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-600 hover:file:bg-purple-100"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button 
                disabled={uploading}
                type="submit"
                className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-3 ${uploading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"}`}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  "Finalize & Upload Track"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
