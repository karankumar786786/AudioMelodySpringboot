"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Eye, EyeOff, Loader2, Play, Trash2 } from "lucide-react";
import {
  formatDuration,
  type ShortAction,
  type ShortItem,
  shortMediaUrl,
} from "../types";

const pill =
  "inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-zinc-300 bg-[#16161a] hover:bg-white hover:text-black border border-white/8 transition-all disabled:opacity-40 cursor-pointer";

const STATUS_STYLE: Record<string, string> = {
  READY: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  PROCESSING: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  UPLOADING: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  FAILED: "bg-red-500/10 text-red-300 border-red-500/20",
  HIDDEN: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  DELETED: "bg-zinc-800 text-zinc-500 border-zinc-700",
};

interface Ctx {
  canModerate: boolean;
  canBan: boolean;
  pending: { id: string; action: ShortAction } | null;
  onAction: (short: ShortItem, action: ShortAction) => void;
  onPreview: (short: ShortItem) => void;
  onBan: (short: ShortItem) => void;
}

export function shortColumns(ctx: Ctx): ColumnDef<ShortItem>[] {
  return [
    {
      id: "short",
      header: "Short",
      accessorFn: (s) => s.caption || "",
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => ctx.onPreview(s)}
              disabled={!s.hlsKey}
              className="relative w-10 h-16 rounded-lg overflow-hidden bg-[#18181c] border border-white/10 shrink-0 disabled:cursor-default cursor-pointer"
              aria-label="Preview short"
            >
              {s.thumbnailKey ? (
                <img
                  src={shortMediaUrl(s.thumbnailKey)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : null}
              {s.hlsKey ? (
                <Play className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
              ) : null}
            </button>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate max-w-[260px]">
                {s.caption || <span className="text-zinc-500">No caption</span>}
              </div>
              <div className="text-zinc-500 text-[11px] truncate max-w-[260px]">
                {s.songTitle ? `♪ ${s.songTitle}` : "No linked song"} ·{" "}
                {formatDuration(s.durationMs)}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const s = row.original;
        const note =
          s.status === "FAILED"
            ? s.failureReason
            : s.status === "HIDDEN"
              ? s.hiddenReason
              : null;
        return (
          <div>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLE[s.status] ?? ""}`}
            >
              {s.status}
            </span>
            {note ? (
              <div
                className="text-[11px] text-zinc-500 mt-1 max-w-[220px] truncate"
                title={note}
              >
                {note}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "owner",
      header: "Posted by",
      accessorFn: (s) => (s.ownerType === "ADMIN" ? "One Melody" : s.userId),
      cell: ({ row }) =>
        row.original.ownerType === "ADMIN" ? (
          <span className="text-xs text-zinc-300">One Melody</span>
        ) : (
          <span className="text-xs text-zinc-400 font-mono">
            {row.original.userId}
          </span>
        ),
    },
    {
      id: "engagement",
      header: "Likes · Views · Reports",
      accessorFn: (s) => s.likesCount,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <span className="text-xs text-zinc-300 tabular-nums">
            {s.likesCount} · {s.viewsCount} ·{" "}
            <span className={s.reportsCount > 0 ? "text-amber-300" : ""}>
              {s.reportsCount}
            </span>
          </span>
        );
      },
    },
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      cell: ({ getValue }) => {
        const v = getValue<string | null>();
        return (
          <span className="text-xs text-zinc-500">
            {v ? new Date(v).toLocaleString() : "–"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original;
        const busy = (a: ShortAction) =>
          ctx.pending?.id === s.id && ctx.pending.action === a;
        if (!ctx.canModerate) return null;
        return (
          <div className="flex justify-end gap-1.5">
            {s.status === "READY" ? (
              <button
                type="button"
                className={pill}
                onClick={() => ctx.onAction(s, "hide")}
              >
                {busy("hide") ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
                Hide
              </button>
            ) : null}
            {s.status === "HIDDEN" ? (
              <button
                type="button"
                className={pill}
                onClick={() => ctx.onAction(s, "unhide")}
              >
                {busy("unhide") ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                Unhide
              </button>
            ) : null}
            {ctx.canBan && s.ownerType === "LISTENER" && s.userId ? (
              <button
                type="button"
                className={pill}
                onClick={() => ctx.onBan(s)}
              >
                <Ban className="w-3 h-3" />
                Ban
              </button>
            ) : null}
            {s.status !== "DELETED" ? (
              <button
                type="button"
                className={pill}
                onClick={() => ctx.onAction(s, "delete")}
              >
                {busy("delete") ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Delete
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];
}
