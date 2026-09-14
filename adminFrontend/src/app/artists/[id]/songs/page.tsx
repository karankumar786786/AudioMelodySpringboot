"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/adminFetch";
import { getImageUrl } from "@/lib/image-utils";

interface Artist {
  id: string;
  name: string;
  about?: string;
  coverImageKey?: string;
  status?: string;
}

interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  songKey: string;
  imageKey: string;
  videoKey?: string;
}

export default function ArtistSongsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Fetch Artist Details — returns ArtistsEntity directly
      const artistRes = await adminFetch(`/admin/artist/${id}`);
      if (artistRes.ok) {
        const artistData = await artistRes.json();
        setArtist(artistData);
      }

      // 2. Fetch Artist Songs via public API — returns PaginatedResponseDto<SongsEntity>
      const songsRes = await adminFetch(`/api/artists/${id}/songs?page=0&size=200`);
      if (songsRes.ok) {
        const songsData = await songsRes.json();
        setSongs(songsData.content || []);
      }
    } catch (err) {
      console.error("Failed to fetch artist data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const formatDuration = (num?: number) => {
    if (!num || isNaN(num)) return "0:00";
    const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 font-medium animate-pulse">Loading discography...</p>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-8">
        <div className="text-center max-w-md">
          <h2 className="text-3xl font-bold text-white mb-4">Artist Not Found</h2>
          <p className="text-zinc-400 mb-8">The artist you are looking for doesn't exist or has been removed from the database.</p>
          <Link href="/artists" className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-8 py-4 rounded-full font-bold transition-all shadow-sm">
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
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative h-[340px] w-full overflow-hidden">
        {artist.coverImageKey ? (
          <img
            src={getImageUrl(artist.coverImageKey, { width: 1200, height: 400, crop: "at_max", focus: "auto" })}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-end gap-8">
            {/* Avatar */}
            <div className="w-36 h-36 rounded-[2rem] border-2 border-[#282828] bg-black/60 overflow-hidden shadow-2xl shrink-0">
              {artist.coverImageKey ? (
                <img
                  src={getImageUrl(artist.coverImageKey, { width: 300, height: 300, focus: "auto", aspectRatio: "1-1" })}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-black/80 flex items-center justify-center text-5xl font-black text-zinc-400">
                  {artist.name[0]}
                </div>
              )}
            </div>

            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-2 text-zinc-400 font-bold uppercase tracking-widest text-xs">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
                </svg>
                Verified Artist
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white mb-3 tracking-tight">
                {artist.name}
              </h1>
              {artist.about && (
                <p className="max-w-2xl text-zinc-400 font-medium leading-relaxed text-sm line-clamp-2">
                  {artist.about}
                </p>
              )}
            </div>

            <div className="pb-2">
              <Link
                href="/artists"
                className="bg-black/60 hover:bg-white hover:text-black border border-[#282828] text-zinc-300 px-5 py-2.5 rounded-full font-bold transition-all flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                All Artists
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto p-8 md:px-12 -mt-4 relative z-10">
        <div className="bg-[#121212] rounded-[2.5rem] border border-[#282828] shadow-xl overflow-hidden">
          <div className="p-8 border-b border-[#282828] flex justify-between items-center bg-black/40">
            <h2 className="text-2xl font-bold text-white">Discography</h2>
            <div className="bg-black/60 border border-[#282828] text-zinc-300 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
              {songs.length} Tracks
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#282828] bg-black/60">
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400">#</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400">Track</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400">Duration</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400">Video Canvas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282828]">
                {songs.map((song, index) => (
                  <tr key={song.id} className="group hover:bg-zinc-800/30 transition-all">
                    <td className="p-6 text-zinc-500 font-mono text-sm w-12">{index + 1}</td>
                    <td className="p-6">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-black/60 border border-[#282828] shrink-0 overflow-hidden">
                          {song.imageKey ? (
                            <img
                              src={getImageUrl(song.imageKey, { width: 100, height: 100, focus: "auto", aspectRatio: "1-1" })}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-white group-hover:text-zinc-300 transition-colors">
                            {song.title}
                          </div>
                          <div className="text-zinc-500 text-xs font-mono mt-0.5">ID: {song.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="bg-black/60 border border-[#282828] text-zinc-300 px-3 py-1.5 rounded-full font-mono text-xs">
                        {formatDuration(song.duration)}
                      </span>
                    </td>
                    <td className="p-6">
                      {song.videoKey ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
                          Video
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {songs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-20 text-center text-zinc-500 italic">
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
