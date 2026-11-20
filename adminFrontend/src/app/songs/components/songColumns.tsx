"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, ListPlus, Star, Trash2 } from "lucide-react";
import {
  AssetIndicators,
  formatDuration,
  GenreBadges,
  iconButton,
  SongTitleCell,
  StatusBadge,
} from "@/components/catalog/SongCells";
import { selectionColumn } from "@/components/data-table/columns";
import type { Song } from "../types";

export interface SongRowActions {
  /** Each handler is left out when the current role may not take that action. */
  onToggleFeatured?: (song: Song) => void;
  onEdit?: (song: Song) => void;
  onDelete?: (song: Song) => void;
  onAddToPlaylist?: (song: Song) => void;
  busyId?: string | null;
}

export function songColumns(
  actions: SongRowActions,
  selectable: boolean,
): ColumnDef<Song>[] {
  const cols: ColumnDef<Song>[] = [
    {
      id: "title",
      accessorFn: (s) => s.title,
      header: "Track / Artist",
      meta: { label: "Title" },
      cell: ({ row }) => <SongTitleCell song={row.original} />,
    },
    {
      id: "artistName",
      accessorFn: (s) => s.artistName,
      header: "Artist",
      cell: ({ getValue }) => (
        <span className="text-zinc-300">{getValue<string>()}</span>
      ),
    },
    {
      id: "album",
      accessorFn: (s) => s.album ?? "",
      header: "Album",
      meta: { cellClassName: "font-medium text-zinc-300 truncate max-w-40" },
      cell: ({ getValue }) =>
        getValue<string>() || <span className="text-zinc-600">—</span>,
    },
    {
      id: "genre",
      accessorFn: (s) => s.genre ?? "",
      header: "Genres",
      enableSorting: false,
      cell: ({ row }) => <GenreBadges genre={row.original.genre} />,
    },
    {
      id: "language",
      accessorFn: (s) => s.language ?? "",
      header: "Language",
      cell: ({ getValue }) => (
        <span className="text-zinc-300">{getValue<string>() || "—"}</span>
      ),
    },
    {
      id: "country",
      accessorFn: (s) => s.country || "India",
      header: "Country",
      cell: ({ getValue }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/6 text-zinc-300 border border-white/8 text-[11px] font-medium whitespace-nowrap">
          {getValue<string>()}
        </span>
      ),
    },
    {
      id: "duration",
      accessorFn: (s) => s.duration ?? 0,
      header: "Duration",
      meta: {
        cellClassName: "font-mono text-zinc-400 tabular-nums",
        csv: (s) => formatDuration(s.duration),
      },
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
      meta: {
        csv: (s) =>
          [
            s.videoKey && "canvas",
            s.fullVideoKey && "full video",
            s.lrclibId && s.lrclibId !== "0" && "lyrics",
          ]
            .filter(Boolean)
            .join(" "),
      },
      cell: ({ row }) => <AssetIndicators song={row.original} />,
    },
    {
      id: "status",
      accessorFn: (s) => s.status || "ACTIVE",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "createdAt",
      accessorFn: (s) => s.createdAt ?? "",
      header: "Added",
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return (
          <span className="text-zinc-500 text-[11px]">
            {v ? new Date(v).toLocaleDateString() : "—"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      meta: {
        csv: false,
        label: "Actions",
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
      cell: ({ row }) => {
        const song = row.original;
        const busy = actions.busyId === song.id;
        return (
          <div className="flex items-center justify-end gap-1">
            {actions.onAddToPlaylist && (
              <button
                type="button"
                onClick={() => actions.onAddToPlaylist?.(song)}
                className={`${iconButton} text-zinc-400 hover:text-white hover:bg-white/10`}
                title="Add to playlist"
                aria-label={`Add ${song.title} to playlist`}
              >
                <ListPlus className="w-3.5 h-3.5" />
              </button>
            )}
            {actions.onToggleFeatured && (
              <button
                type="button"
                onClick={() => actions.onToggleFeatured?.(song)}
                disabled={busy}
                aria-pressed={Boolean(song.isFeatured)}
                className={`${iconButton} ${
                  song.isFeatured
                    ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/6"
                }`}
                title={
                  song.isFeatured
                    ? "Remove from Featured Hero"
                    : "Promote to Featured Hero"
                }
                aria-label={
                  song.isFeatured
                    ? `Unfeature ${song.title}`
                    : `Feature ${song.title}`
                }
              >
                <Star
                  className={`w-3.5 h-3.5 ${song.isFeatured ? "fill-amber-400" : ""}`}
                />
              </button>
            )}
            {actions.onEdit && (
              <button
                type="button"
                onClick={() => actions.onEdit?.(song)}
                className={`${iconButton} text-zinc-400 hover:text-white hover:bg-white/6`}
                title="Edit track metadata"
                aria-label={`Edit ${song.title}`}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {actions.onDelete && (
              <button
                type="button"
                onClick={() => actions.onDelete?.(song)}
                disabled={busy}
                className={`${iconButton} text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10`}
                title="Delete track"
                aria-label={`Delete ${song.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];
  return selectable ? [selectionColumn<Song>(), ...cols] : cols;
}

/** Hidden until turned on in the column menu; the title cell already shows the artist. */
export const SONG_DEFAULT_HIDDEN = ["artistName", "language", "createdAt"];
