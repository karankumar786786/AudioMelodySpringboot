"use client";

import { getImageUrl } from "@/lib/image-utils";

export interface DiscographySong {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  songKey: string;
  imageKey: string;
  videoKey?: string;
  album?: string;
  totalStreams?: number;
}

interface ArtistDiscographyTableProps {
  songs: DiscographySong[];
}

export function ArtistDiscographyTable({ songs }: ArtistDiscographyTableProps) {
  const formatDuration = (num?: number) => {
    if (!num || isNaN(num)) return "0:00";
    const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
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
                <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400">Album</th>
                <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400">Streams</th>
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
                            src={getImageUrl(song.imageKey, {
                              width: 100,
                              height: 100,
                              focus: "auto",
                              aspectRatio: "1-1",
                            })}
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
                        <div className="text-zinc-500 text-xs font-mono mt-0.5">
                          ID: {song.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="text-zinc-400 text-sm font-medium">
                      {song.album || "—"}
                    </span>
                  </td>
                  <td className="p-6">
                    <span className="text-emerald-400 font-mono text-xs font-bold">
                      {(song.totalStreams || 0).toLocaleString()}
                    </span>
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
                  <td colSpan={6} className="p-20 text-center text-zinc-500 italic">
                    No songs uploaded for this artist yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
