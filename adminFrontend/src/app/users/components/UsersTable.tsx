"use client";

import React from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
  ArrowUpCircle,
  ArrowDownCircle,
  Mail,
  Loader2,
  Smartphone,
} from "lucide-react";
import { UserItem, UserActionType } from "../types";
import { TableSkeleton } from "@/components/TableSkeleton";
import { PaginationBar } from "@/components/PaginationBar";

export interface UsersTableProps {
  users: UserItem[];
  loading: boolean;
  currentUser: any;
  actionLoading: { [email: string]: string };
  onUserAction: (user: UserItem, action: UserActionType) => void;
  page: number;
  pageSize: number;
  totalUsers: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  loading,
  currentUser,
  actionLoading,
  onUserAction,
  page,
  pageSize,
  totalUsers,
  onPageChange,
  onPageSizeChange,
}) => {
  return (
    <div className="relative bg-[#121215] rounded-2xl border border-white/8 overflow-hidden shadow-sm">
      {/* Top Animated Pulse Line during page/filter transitions */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-zinc-500 via-white to-zinc-400 animate-pulse z-20" />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#0e0e11] border-b border-white/8 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <th className="px-5 py-3.5">User</th>
              <th className="px-5 py-3.5">Email</th>
              <th className="px-5 py-3.5">Role</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {loading ? (
              <TableSkeleton variant="user" rows={Math.min(pageSize, 8)} />
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-zinc-400 font-sans">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-30 text-zinc-500" />
                  <p className="font-semibold text-sm text-zinc-300">
                    No accounts matched your filters
                  </p>
                  <p className="text-xs mt-1 text-zinc-500">
                    Try adjusting your search query or role filter tabs.
                  </p>
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const displayName = u.userName || u.name || u.email.split("@")[0];
                const initial = displayName[0]?.toUpperCase() || "U";
                const roleStr = (u.role || "USER").toUpperCase();
                const isSuperAdmin = roleStr === "SUPER_ADMIN" || roleStr === "SUPERADMIN";
                const isAdmin = roleStr === "ADMIN" || isSuperAdmin;
                const isBlocked = (u.status || "ACTIVE").toUpperCase() === "BLOCKED";
                const isSelf = u.id === currentUser?.id || u.email === currentUser?.email;
                const currentOp = actionLoading[u.email];

                return (
                  <tr
                    key={u.id || u.email}
                    className="group hover:bg-white/3 transition-colors"
                  >
                    {/* User Info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                            isAdmin
                              ? "bg-white text-black font-black"
                              : "bg-[#18181c] text-zinc-300 border border-white/10"
                          }`}
                        >
                          {initial}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">
                              {displayName}
                            </span>
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
                    </td>

                    {/* Email */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-mono">
                        <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate max-w-[200px]">{u.email}</span>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="px-5 py-3.5">
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
                        <span>{roleStr}</span>
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isBlocked
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                            : "bg-white/10 text-white border-white/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isBlocked ? "bg-rose-500" : "bg-white"
                          }`}
                        />
                        <span>{isBlocked ? "Blocked" : "Active"}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {/* Role Toggle: Promote or Demote */}
                        {!isSuperAdmin && !isSelf && (
                          <>
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => onUserAction(u, "demote")}
                                disabled={Boolean(currentOp) || loading}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-zinc-300 bg-[#16161a] hover:bg-white hover:text-black border border-white/8 transition-all disabled:opacity-40 cursor-pointer"
                                title="Demote to standard User"
                              >
                                {currentOp === "demote" ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                                ) : (
                                  <ArrowDownCircle className="w-3 h-3 text-amber-400" />
                                )}
                                <span className="hidden sm:inline text-[11px]">Demote</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUserAction(u, "promote")}
                                disabled={Boolean(currentOp) || loading}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-zinc-300 bg-[#16161a] hover:bg-white hover:text-black border border-white/8 transition-all disabled:opacity-40 cursor-pointer"
                                title="Promote to Admin"
                              >
                                {currentOp === "promote" ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                                ) : (
                                  <ArrowUpCircle className="w-3 h-3 text-white" />
                                )}
                                <span className="hidden sm:inline text-[11px]">Make Admin</span>
                              </button>
                            )}
                          </>
                        )}

                        {/* Devices / Sessions Button */}
                        <button
                          type="button"
                          onClick={() => onUserAction(u, "sessions")}
                          disabled={loading}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-zinc-300 bg-[#16161a] hover:bg-white hover:text-black border border-white/8 transition-all disabled:opacity-40 cursor-pointer"
                          title="View and manage connected devices"
                        >
                          <Smartphone className="w-3 h-3 text-zinc-300" />
                          <span className="hidden sm:inline text-[11px]">Devices</span>
                        </button>

                        {/* Block / Unblock Toggle */}
                        {!isSelf && !isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => onUserAction(u, isBlocked ? "unblock" : "block")}
                            disabled={Boolean(currentOp) || loading}
                            className={`p-1.5 rounded-xl border transition-all disabled:opacity-40 cursor-pointer ${
                              isBlocked
                                ? "bg-white/10 text-white border-white/20 hover:bg-white/20"
                                : "bg-[#16161a] text-zinc-400 hover:text-amber-400 border-white/8 hover:border-amber-400/30"
                            }`}
                            title={isBlocked ? "Unblock User" : "Block User"}
                          >
                            {currentOp === "block" || currentOp === "unblock" ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isBlocked ? (
                              <UserCheck className="w-3.5 h-3.5" />
                            ) : (
                              <UserX className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Delete User */}
                        {!isSelf && !isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => onUserAction(u, "delete")}
                            disabled={Boolean(currentOp) || loading}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                            title="Delete User permanently"
                          >
                            {currentOp === "delete" ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <PaginationBar
        page={page}
        pageSize={pageSize}
        totalItems={totalUsers}
        currentCount={users.length}
        itemLabel="users"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        loading={loading}
      />
    </div>
  );
};
