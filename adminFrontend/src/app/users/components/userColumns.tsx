"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { selectionColumn } from "@/components/data-table/columns";
import type { Permission } from "@/lib/permissions";
import type { UserActionType, UserItem } from "../types";

export function roleOf(u: UserItem) {
  const role = (u.role || "USER").toUpperCase();
  const isSuperAdmin = role === "SUPER_ADMIN" || role === "SUPERADMIN";
  return { role, isSuperAdmin, isAdmin: role === "ADMIN" || isSuperAdmin };
}

const pill =
  "inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-zinc-300 bg-[#16161a] hover:bg-white hover:text-black border border-white/8 transition-all disabled:opacity-40 cursor-pointer";

interface Ctx {
  currentUser: { id?: string; email?: string } | null;
  can: (p: Permission) => boolean;
  pending: { email: string; action: UserActionType } | null;
  onAction: (user: UserItem, action: UserActionType) => void;
}

/** Which account actions the signed-in role may take on `u` (mirrors the backend checks). */
export function allowedActions(
  u: UserItem,
  { currentUser, can }: Pick<Ctx, "currentUser" | "can">,
) {
  const { isAdmin, isSuperAdmin } = roleOf(u);
  const isSelf = u.id === currentUser?.id || u.email === currentUser?.email;
  const protectedTarget = isSelf || isSuperAdmin;
  return {
    isSelf,
    promote: !protectedTarget && !isAdmin && can("user.promote"),
    demote: !protectedTarget && isAdmin && can("user.demote"),
    block: !protectedTarget && can(isAdmin ? "user.blockAdmin" : "user.block"),
    delete: !protectedTarget && can("user.delete"),
    sessions: can("user.sessions"),
  };
}

export function userColumns(ctx: Ctx): ColumnDef<UserItem>[] {
  return [
    selectionColumn<UserItem>(),
    {
      id: "name",
      accessorFn: (u) => u.userName || u.name || u.email.split("@")[0],
      header: "User",
      cell: ({ row, getValue }) => {
        const u = row.original;
        const name = getValue<string>();
        const { isAdmin } = roleOf(u);
        const isSelf =
          u.id === ctx.currentUser?.id || u.email === ctx.currentUser?.email;
        return (
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                isAdmin
                  ? "bg-white text-black font-black"
                  : "bg-[#18181c] text-zinc-300 border border-white/10"
              }`}
            >
              {name[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">{name}</span>
                {isSelf && (
                  <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-white text-black">
                    You
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                ID: {u.id ? `${u.id.substring(0, 8)}...` : "N/A"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "email",
      accessorFn: (u) => u.email,
      header: "Email",
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-mono">
          <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="truncate max-w-[200px]">{getValue<string>()}</span>
        </div>
      ),
    },
    {
      id: "role",
      accessorFn: (u) => roleOf(u).role,
      header: "Role",
      cell: ({ row }) => {
        const { role, isAdmin, isSuperAdmin } = roleOf(row.original);
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isSuperAdmin
                ? "bg-amber-400/10 text-amber-400 border-amber-400/25"
                : isAdmin
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-zinc-800/40 text-zinc-400 border-zinc-700/40"
            }`}
          >
            {isSuperAdmin ? (
              <ShieldAlert className="w-3 h-3" />
            ) : isAdmin ? (
              <ShieldCheck className="w-3 h-3" />
            ) : (
              <UserCheck className="w-3 h-3 text-zinc-400" />
            )}
            <span>{role}</span>
          </span>
        );
      },
    },
    {
      id: "status",
      accessorFn: (u) => (u.status || "ACTIVE").toUpperCase(),
      header: "Status",
      cell: ({ getValue }) => {
        const blocked = getValue<string>() === "BLOCKED";
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              blocked
                ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                : "bg-white/10 text-white border-white/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${blocked ? "bg-rose-500" : "bg-white"}`}
            />
            <span>{blocked ? "Blocked" : "Active"}</span>
          </span>
        );
      },
    },
    {
      id: "createdAt",
      accessorFn: (u) => u.createdAt ?? "",
      header: "Joined",
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
        const u = row.original;
        const allowed = allowedActions(u, ctx);
        const { isAdmin } = roleOf(u);
        const isBlocked = (u.status || "ACTIVE").toUpperCase() === "BLOCKED";
        const op = ctx.pending?.email === u.email ? ctx.pending.action : null;
        const spin = (a: UserActionType) => op === a;
        return (
          <div className="inline-flex items-center justify-end gap-1.5">
            {allowed.demote && (
              <button
                type="button"
                onClick={() => ctx.onAction(u, "demote")}
                disabled={Boolean(op)}
                className={pill}
                title="Demote to standard User"
              >
                {spin("demote") ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ArrowDownCircle className="w-3 h-3 text-amber-400" />
                )}
                <span className="hidden sm:inline text-[11px]">Demote</span>
              </button>
            )}
            {allowed.promote && !isAdmin && (
              <button
                type="button"
                onClick={() => ctx.onAction(u, "promote")}
                disabled={Boolean(op)}
                className={pill}
                title="Promote to Admin"
              >
                {spin("promote") ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ArrowUpCircle className="w-3 h-3 text-white" />
                )}
                <span className="hidden sm:inline text-[11px]">Make Admin</span>
              </button>
            )}
            {allowed.sessions && (
              <button
                type="button"
                onClick={() => ctx.onAction(u, "sessions")}
                className={pill}
                title="View and manage connected devices"
              >
                <Smartphone className="w-3 h-3 text-zinc-300" />
                <span className="hidden sm:inline text-[11px]">Devices</span>
              </button>
            )}
            {allowed.block && (
              <button
                type="button"
                onClick={() => ctx.onAction(u, isBlocked ? "unblock" : "block")}
                disabled={Boolean(op)}
                aria-label={
                  isBlocked ? `Unblock ${u.email}` : `Block ${u.email}`
                }
                className={`p-1.5 rounded-xl border transition-all disabled:opacity-40 cursor-pointer ${
                  isBlocked
                    ? "bg-white/10 text-white border-white/20 hover:bg-white/20"
                    : "bg-[#16161a] text-zinc-400 hover:text-amber-400 border-white/8 hover:border-amber-400/30"
                }`}
                title={isBlocked ? "Unblock User" : "Block User"}
              >
                {spin("block") || spin("unblock") ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isBlocked ? (
                  <UserCheck className="w-3.5 h-3.5" />
                ) : (
                  <UserX className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {allowed.delete && (
              <button
                type="button"
                onClick={() => ctx.onAction(u, "delete")}
                disabled={Boolean(op)}
                aria-label={`Delete ${u.email}`}
                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                title="Delete User permanently"
              >
                {spin("delete") ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        );
      },
    },
  ];
}
