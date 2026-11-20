"use client";

import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Film, Loader2, Music, Plus, Star, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PlaylistSong } from "@/app/playlists/types";
import {
  AssetIndicators,
  formatDuration,
  GenreBadges,
  iconButton,
  SongTitleCell,
  StatusBadge,
} from "@/components/catalog/SongCells";
import { DataTable } from "@/components/data-table/DataTable";
import { SearchInput, SegmentedFilter } from "@/components/data-table/Toolbar";
import { type TrackFilter, usePlaylistTrackFilter } from "./usePlaylistTrackFilter";

function columns(onRemove: ((s: PlaylistSong) => void) | undefined, removingId: string | null): ColumnDef<PlaylistSong>[] {
  const cols: ColumnDef<PlaylistSong>[] = [
    {
      id: "index",
      header: "#",
      enableSorting: false,
      meta: { csv: false, headerClassName: "w-12 text-center", cellClassName: "font-mono text-zinc-500 text-center" },
      cell: ({ row }) => row.index + 1,
    },
    {
      id: "title",
      accessorFn: (s) => s.title,
      header: "Track / Artist",
      meta: { label: "Title" },
      cell: ({ row }) => <SongTitleCell song={row.original} maxWidth="max-w-[260px]" />,
    },
    {
      id: "artistName",
      accessorFn: (s) => s.artistName ?? "",
      header: "Artist",
    },
    {
      id: "genre",
      accessorFn: (s) => s.genre ?? "",
      header: "Genres",
      enableSorting: false,
      cell: ({ row }) => <GenreBadges genre={row.original.genre} />,
    },
    {
      id: "duration",
      accessorFn: (s) => s.duration ?? 0,
      header: "Duration",
      meta: { cellClassName: "font-mono text-zinc-400 tabular-nums", csv: (s) => formatDuration(s.duration) },
      cell: ({ row }) => formatDuration(row.original.duration),
    },
    {
      id: "totalStreams",
      accessorFn: (s) => s.totalStreams ?? 0,
      header: "Streams",
      meta: { cellClassName: "font-mono text-white tabular-nums" },
      cell: ({ getValue }) => getValue<number>().toLocaleString(),
    },
    {
      id: "assets",
      header: "Assets",
      enableSorting: false,
      meta: { csv: false },
      cell: ({ row }) => <AssetIndicators song={row.original} />,
    },
    {
      id: "status",
      accessorFn: (s) => s.status || "ACTIVE",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];
  if (onRemove) {
    cols.push({
      id: "remove",
      header: "Remove",
      enableSorting: false,
      enableHiding: false,
      meta: { csv: false, headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <button
          type="button"
          disabled={removingId === row.original.id}
          onClick={() => onRemove(row.original)}
          className={`${iconButton} text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10`}
          title="Remove track from this playlist"
          aria-label={`Remove ${row.original.title} from playlist`}
        >
          {removingId === row.original.id ? (
            <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      ),
    });
  }
  return cols;
}

const FILTERS: { value: TrackFilter; label: React.ReactNode }[] = [
  { value: "ALL", label: "All" },
  {
    value: "FEATURED",
    label: (
      <>
        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Featured
      </>
    ),
  },
  {
    value: "CANVAS",
    label: (
      <>
        <Film className="w-3.5 h-3.5" /> Canvas
      </>
    ),
  },
  {
    value: "FULL_VIDEO",
    label: (
      <>
        <Video className="w-3.5 h-3.5" /> Full Video
      </>
    ),
  },
];

export function PlaylistTracksTable({
  playlistId,
  songs,
  loading,
  onRemove,
  removingId,
}: {
  playlistId: string;
  songs: PlaylistSong[];
  loading: boolean;
  onRemove?: (song: PlaylistSong) => void;
  removingId: string | null;
}) {
  const { search, setSearch, filter, setFilter, filtered } = usePlaylistTrackFilter(songs);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const cols = useMemo(() => columns(onRemove, removingId), [onRemove, removingId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: back to the first page when the filter changes
  useEffect(() => setPagination((p) => ({ ...p, pageIndex: 0 })), [search, filter]);

  const start = pagination.pageIndex * pagination.pageSize;
  const page = filtered.slice(start, start + pagination.pageSize);

  const empty = (
    <div className="p-16 text-center text-zinc-500 text-sm space-y-3">
      <Music className="w-12 h-12 text-zinc-600 mx-auto" />
      <h4 className="text-white font-bold text-base">
        {songs.length === 0 ? "No tracks in this playlist yet" : "No matching tracks found"}
      </h4>
      <p className="text-zinc-500 text-xs max-w-md mx-auto">
        {songs.length === 0
          ? "Head over to the Songs Studio catalog and click the '+' button on any track to add it directly to this playlist."
          : "Try clearing your search query or switching the filter."}
      </p>
      {songs.length === 0 && (
        <Link
          href="/songs"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shadow-sm mt-2"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Go to Songs Catalog</span>
        </Link>
      )}
    </div>
  );

  return (
    <DataTable<PlaylistSong>
      columns={cols}
      data={page}
      getRowId={(s) => s.id}
      rowCount={filtered.length}
      pagination={pagination}
      onPaginationChange={setPagination}
      loading={loading}
      toolbar={
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Filter tracks by title, artist, genre, or album..."
          />
          <SegmentedFilter<TrackFilter>
            label="Track filter"
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((f) => (f.value === "ALL" ? { ...f, label: `All (${songs.length})` } : f))}
          />
        </>
      }
      emptyState={empty}
      exportFileName={`playlist-${playlistId}`}
      storageKey="playlist-tracks"
      defaultHiddenColumns={["artistName"]}
      itemLabel="tracks"
      pageSizeOptions={[20, 50, 100, 500]}
    />
  );
}
