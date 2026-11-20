"use client";

import { ArrowLeft, Loader2, Music, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback } from "react";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { usePermissions } from "@/lib/permissions";
import { useDeletePlaylist, usePlaylist, usePlaylistSongs, useRemovePlaylistSong } from "@/lib/queries/playlists";
import type { PlaylistSong } from "../types";
import { PlaylistHero } from "./components/PlaylistHero";
import { PlaylistTracksTable } from "./components/PlaylistTracksTable";

function NotFound() {
  return (
    <div className="p-8 max-w-xl mx-auto text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/8 flex items-center justify-center mx-auto text-zinc-500">
        <Music className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-white">Playlist Not Found</h2>
      <p className="text-xs text-zinc-400">The requested playlist collection may have been removed or does not exist.</p>
      <Link
        href="/playlists"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Playlists</span>
      </Link>
    </div>
  );
}

export default function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const { can } = usePermissions();

  const playlistQuery = usePlaylist(id);
  const songsQuery = usePlaylistSongs(id);
  const removeSong = useRemovePlaylistSong(id);
  const deletePlaylist = useDeletePlaylist();

  const playlist = playlistQuery.data;
  const songs = songsQuery.data ?? [];
  const removingId = removeSong.isPending ? (removeSong.variables?.id ?? null) : null;
  const handleRemove = useCallback((song: PlaylistSong) => removeSong.mutate(song), [removeSong.mutate]);

  if (playlistQuery.isPending) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <span className="text-xs text-zinc-500 font-mono tracking-wider">LOADING PLAYLIST WORKSPACE...</span>
      </div>
    );
  }
  if (!playlist) return <NotFound />;

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete playlist "${playlist.name}"?`,
      description: "This action cannot be undone.",
      confirmLabel: "Delete playlist",
      destructive: true,
      typeToConfirm: playlist.name,
    });
    if (!ok) return;
    deletePlaylist.mutate(playlist, { onSuccess: () => router.push("/playlists") });
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8 text-white font-sans">
      <div className="flex items-center justify-between">
        <Link
          href="/playlists"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Playlists</span>
        </Link>
        {can("playlist.delete") && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deletePlaylist.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Delete this entire playlist"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Playlist</span>
          </button>
        )}
      </div>

      <PlaylistHero playlist={playlist} songs={songs} editable={can("playlist.edit")} />

      <PlaylistTracksTable
        playlistId={id}
        songs={songs}
        loading={songsQuery.isPending}
        onRemove={can("playlist.edit") ? handleRemove : undefined}
        removingId={removingId}
      />
    </div>
  );
}
