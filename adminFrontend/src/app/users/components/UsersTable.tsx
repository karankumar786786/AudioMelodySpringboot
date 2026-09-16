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
    <div className="bg-[#121212] rounded-3xl border border-[#282828] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-black/60 border-b border-[#282828] text-xs font-bold uppercase tracking-wider text-zinc-400">
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#282828]">
            {loading ? (
              <TableSkeleton variant="user" rows={pageSize > 10 ? 8 : pageSize} />
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-zinc-400">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-30 text-zinc-500" />
                  <p className="font-semibold text-base text-zinc-300">
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
                    className="group hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* User Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                            isAdmin
                              ? "bg-white text-black font-bold"
                              : "bg-black/60 text-zinc-300 border border-[#282828]"
                          }`}
                        >
                          {initial}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {displayName}
                            </span>
                            {isSelf && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-black">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500 font-mono">
                            ID: {u.id ? `${u.id.substring(0, 8)}...` : "N/A"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-zinc-300 text-sm font-mono">
                        <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate max-w-[220px]">{u.email}</span>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          isAdmin
                            ? "bg-white text-black border-white"
                            : "bg-black/60 text-zinc-300 border-[#282828]"
                        }`}
                      >
                        {isSuperAdmin ? (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        ) : isAdmin ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        {roleStr}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          isBlocked
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isBlocked ? "bg-rose-500" : "bg-emerald-400"
                          }`}
                        />
                        {isBlocked ? "Blocked" : "Active"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {/* Role Toggle: Promote or Demote */}
                        {!isSuperAdmin && !isSelf && (
                          <>
                            {isAdmin ? (
                              <button
                                onClick={() => onUserAction(u, "demote")}
                                disabled={!!currentOp}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-300 bg-black/60 hover:bg-white hover:text-black border border-[#282828] transition-all disabled:opacity-40"
                                title="Demote to standard User"
                              >
                                {currentOp === "demote" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                                ) : (
                                  <ArrowDownCircle className="w-3.5 h-3.5 text-amber-400" />
                                )}
                                <span className="hidden sm:inline">Demote</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onUserAction(u, "promote")}
                                disabled={!!currentOp}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-300 bg-black/60 hover:bg-white hover:text-black border border-[#282828] transition-all disabled:opacity-40"
                                title="Promote to Admin"
                              >
                                {currentOp === "promote" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                                ) : (
                                  <ArrowUpCircle className="w-3.5 h-3.5 text-white" />
                                )}
                                <span className="hidden sm:inline">Make Admin</span>
                              </button>
                            )}
                          </>
                        )}

                        {/* Block / Unblock Toggle */}
                        {!isSuperAdmin && !isSelf && (
                          <button
                            onClick={() =>
                              onUserAction(u, isBlocked ? "unblock" : "block")
                            }
                            disabled={!!currentOp}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-40 bg-black/60 hover:bg-white hover:text-black ${
                              isBlocked
                                ? "text-emerald-400 border-[#282828]"
                                : "text-amber-400 border-[#282828]"
                            }`}
                            title={isBlocked ? "Unblock account" : "Block account"}
                          >
                            {currentOp === "block" || currentOp === "unblock" ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                            ) : isBlocked ? (
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <UserX className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            <span className="hidden sm:inline">
                              {isBlocked ? "Unblock" : "Block"}
                            </span>
                          </button>
                        )}

                        {/* Delete Action */}
                        {!isSuperAdmin && !isSelf && (
                          <button
                            onClick={() => onUserAction(u, "delete")}
                            disabled={!!currentOp}
                            className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-full border border-transparent transition-all disabled:opacity-40"
                            title="Delete user account"
                          >
                            {currentOp === "delete" ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
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

      {/* Reusable Pagination Bar */}
      <PaginationBar
        page={page}
        pageSize={pageSize}
        totalItems={totalUsers}
        currentCount={users.length}
        itemLabel="accounts"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        loading={loading}
      />
    </div>
  );
};
