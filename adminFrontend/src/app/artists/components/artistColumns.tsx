"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Mic2, Trash2 } from "lucide-react";
import Link from "next/link";
import { iconButton, StatusBadge } from "@/components/catalog/SongCells";
import { selectionColumn } from "@/components/data-table/columns";
import { getImageUrl } from "@/lib/image-utils";
import type { Artist } from "../types";

export function artistColumns({
  onDelete,
}: {
  onDelete?: (a: Artist) => void;
}): ColumnDef<Artist>[] {
  return [
    selectionColumn<Artist>(),
    {
      id: "name",
      accessorFn: (a) => a.name,
      header: "Artist",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0 flex items-center justify-center">
              {a.coverImageKey ? (
                <img
                  src={getImageUrl(a.coverImageKey, { width: 80, height: 80 })}
                  alt={a.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Mic2 className="w-4 h-4 text-zinc-600" />
              )}
            </div>
            <span className="font-bold text-white">{a.name}</span>
          </div>
        );
      },
    },
    {
      id: "about",
      accessorFn: (a) => a.about ?? "",
      header: "About",
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-zinc-400 line-clamp-2 max-w-md">
          {getValue<string>() || "—"}
        </span>
      ),
    },
    {
      id: "dob",
      accessorFn: (a) => a.dob ?? "",
      header: "Born",
      cell: ({ getValue }) => (
        <span className="text-zinc-400 font-mono">
          {getValue<string>() || "—"}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (a) => a.status || "ACTIVE",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/artists/${row.original.id}/songs`}
            className={`${iconButton} text-zinc-400 hover:text-white hover:bg-white/10`}
            title="View discography"
            aria-label={`View ${row.original.name} discography`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(row.original)}
              className={`${iconButton} text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10`}
              title="Delete artist"
              aria-label={`Delete ${row.original.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];
}
