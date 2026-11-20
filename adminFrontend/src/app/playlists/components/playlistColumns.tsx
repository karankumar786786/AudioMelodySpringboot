"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ListMusic, Trash2, Video } from "lucide-react";
import { iconButton, StatusBadge } from "@/components/catalog/SongCells";
import { selectionColumn } from "@/components/data-table/columns";
import { getImageUrl } from "@/lib/image-utils";
import type { Playlist } from "../types";

export function playlistColumns({
  onDelete,
  deletingId,
}: {
  onDelete?: (p: Playlist) => void;
  deletingId?: string | null;
}): ColumnDef<Playlist>[] {
  return [
    selectionColumn<Playlist>(),
    {
      id: "name",
      accessorFn: (p) => p.name,
      header: "Playlist",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0 flex items-center justify-center">
              {p.coverImageKey ? (
                <img
                  src={getImageUrl(p.coverImageKey, { width: 80, height: 80 })}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ListMusic className="w-4 h-4 text-zinc-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white truncate max-w-60">{p.name}</p>
              <p className="text-[11px] text-zinc-500 truncate max-w-60">
                {p.description || "No description"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "totalSongs",
      accessorFn: (p) => p.totalSongs ?? 0,
      header: "Tracks",
      meta: { cellClassName: "font-mono text-white tabular-nums" },
    },
    {
      id: "videoKey",
      accessorFn: (p) => (p.videoKey ? "yes" : "no"),
      header: "Teaser",
      meta: { label: "Teaser video" },
      cell: ({ row }) =>
        row.original.videoKey ? (
          <span className="inline-flex items-center gap-1 text-zinc-200">
            <Video className="w-3.5 h-3.5" /> Attached
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        ),
    },
    {
      id: "status",
      accessorFn: (p) => p.status || "ACTIVE",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "createdAt",
      accessorFn: (p) => p.createdAt ?? "",
      header: "Created",
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
      cell: ({ row }) =>
        onDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(row.original);
            }}
            disabled={deletingId === row.original.id}
            className={`${iconButton} text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10`}
            title="Delete playlist"
            aria-label={`Delete ${row.original.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : null,
    },
  ];
}
