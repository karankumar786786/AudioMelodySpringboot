"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/adminFetch";

interface Artist {
  id: string;
  name: string;
  about: string;
  coverImageKey: string;
  bannerImageKey: string;
}

interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  songKey: string;
  imageKey: string;
}

export default function ArtistSongsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Fetch Artist Details
      const artistRes = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/artists/${id}`);
      const artistData = await artistRes.json();
      if (artistData.success) setArtist(artistData.data);
      
      // 2. Fetch Artist Songs
      const songsRes = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/artists/${id}/songs`);
      const songsData = await songsRes.json();
      if (songsData.success) setSongs(songsData.data.data || []);
    } catch (err) {
      console.error("Failed to fetch artist data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium animate-pulse">Loading discography...</p>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 p-8">
        <div className="text-center max-w-md">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">Artist Not Found</h2>
          <p className="text-zinc-500 mb-8">The artist you are looking for doesn't exist or has been removed from the database.</p>
          <Link href="/artists" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Artists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <div className="relative h-[400px] w-full overflow-hidden">
        <img 
          src={`https://ik.imagekit.io/zaa6pbi9f${artist.bannerImageKey || artist.coverImageKey}`} 
          alt={artist.name} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 dark:from-zinc-950 via-black/40 to-transparent" />
        
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-16">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-end gap-8">
            <div className="w-48 h-48 rounded-[2.5rem] border-4 border-white dark:border-zinc-800 overflow-hidden shadow-2xl shrink-0">
              <img 
                src={`https://ik.imagekit.io/zaa6pbi9f${artist.coverImageKey}`} 
                alt={artist.name} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-3 mb-2 text-indigo-500 font-bold uppercase tracking-widest text-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                Verified Artist
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">
                {artist.name}
              </h1>
              <p className="max-w-2xl text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                {artist.about}
              </p>
            </div>
            <div className="pb-4">
              <Link href="/artists" className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-zinc-900 dark:text-white px-6 py-3 rounded-2xl font-bold border border-white/20 transition-all flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Exit Session
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto p-8 md:p-16 -mt-8 relative z-10">
        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
          <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/10">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Discography</h2>
            <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">
              {songs.length} Tracks Found
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/5">
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400">#</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400">Track</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400">Duration</th>
                </tr>
              </thead>
              <tbody>
                {songs.map((song, index) => (
                  <tr key={song.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all">
                    <td className="p-6 text-zinc-400 font-medium">{index + 1}</td>
                    <td className="p-6">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 shrink-0 overflow-hidden shadow-inner group-hover:shadow-md transition-all">
                          {song.imageKey ? (
                            <img src={`https://ik.imagekit.io/zaa6pbi9f${song.imageKey}`} alt={song.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-400"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-white text-lg mb-0.5 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{song.title}</div>
                          <div className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Master Recording</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-3 py-1.5 rounded-xl font-bold text-xs tabular-nums shadow-inner">
                        {formatDuration(song.duration)}
                      </span>
                    </td>
                  </tr>
                ))}
                {songs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-20 text-center text-zinc-500 italic">
                      No songs uploaded for this artist yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
