"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { adminFetch } from "@/lib/adminFetch";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Toast, ToastType } from "@/components/Toast";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
  UserPlus,
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
} from "lucide-react";

interface UserItem {
  id: string;
  userName?: string | null;
  name?: string | null;
  email: string;
  role: string;
  status: "ACTIVE" | "BLOCKED" | "DELETED" | string;
  createdAt?: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "USER">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "BLOCKED">("ALL");

  // Action states: tracks which user email is undergoing which action
  const [actionLoading, setActionLoading] = useState<{ [email: string]: string }>({});

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
  };

  const fetchUsers = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await adminFetch("/admin/account?page=0&size=100");
      if (res.ok) {
        const data = await res.json();
        const content = data.content || data.data?.content || data.data || [];
        setUsers(content);
      } else {
        const err = await res.json().catch(() => null);
        showToast(err?.message || "Failed to load system accounts", "error");
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
      showToast("Network error connecting to backend service", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Execute an action on a user
  const handleUserAction = async (
    user: UserItem,
    action: "promote" | "demote" | "block" | "unblock" | "delete"
  ) => {
    const isSelf = user.id === currentUser?.id || user.email === currentUser?.email;
    if (isSelf && (action === "block" || action === "demote" || action === "delete")) {
      showToast("You cannot perform destructive actions on your own active account", "error");
      return;
    }

    if (action === "delete") {
      if (!confirm(`Are you sure you want to permanently delete ${user.email}? This action cannot be undone.`)) {
        return;
      }
    }

    setActionLoading((prev) => ({ ...prev, [user.email]: action }));

    try {
      let endpoint = "";
      let method = "POST";

      switch (action) {
        case "promote":
          endpoint = `/admin/account/${encodeURIComponent(user.email)}`;
          method = "POST";
          break;
        case "demote":
          endpoint = `/admin/account/${encodeURIComponent(user.email)}/demote`;
          method = "POST";
          break;
        case "block":
          endpoint = `/admin/account/${encodeURIComponent(user.email)}/block`;
          method = "POST";
          break;
        case "unblock":
          endpoint = `/admin/account/${encodeURIComponent(user.email)}/unblock`;
          method = "POST";
          break;
        case "delete":
          endpoint = `/admin/account/${encodeURIComponent(user.email)}`;
          method = "DELETE";
          break;
      }

      const res = await adminFetch(endpoint, { method });

      if (res.ok) {
        if (action === "delete") {
          setUsers((prev) => prev.filter((u) => u.email !== user.email));
          showToast(`Account ${user.email} was successfully deleted`);
        } else if (action === "promote") {
          setUsers((prev) =>
            prev.map((u) => (u.email === user.email ? { ...u, role: "ADMIN" } : u))
          );
          showToast(`${user.email} promoted to Administrator`);
        } else if (action === "demote") {
          setUsers((prev) =>
            prev.map((u) => (u.email === user.email ? { ...u, role: "USER" } : u))
          );
          showToast(`${user.email} demoted to Standard User`);
        } else if (action === "block") {
          setUsers((prev) =>
            prev.map((u) => (u.email === user.email ? { ...u, status: "BLOCKED" } : u))
          );
          showToast(`Account ${user.email} has been blocked`);
        } else if (action === "unblock") {
          setUsers((prev) =>
            prev.map((u) => (u.email === user.email ? { ...u, status: "ACTIVE" } : u))
          );
          showToast(`Account ${user.email} has been unblocked`);
        }
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.message || `Action '${action}' failed`, "error");
      }
    } catch (err) {
      console.error(`Error performing ${action}:`, err);
      showToast(`Error executing ${action} on account`, "error");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[user.email];
        return next;
      });
    }
  };

  // Filtered and searched users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Query filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.userName && u.userName.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Role filter
      if (roleFilter !== "ALL") {
        const isAdmin =
          u.role?.toUpperCase() === "ADMIN" ||
          u.role?.toUpperCase() === "SUPER_ADMIN" ||
          u.role?.toUpperCase() === "SUPERADMIN";
        if (roleFilter === "ADMIN" && !isAdmin) return false;
        if (roleFilter === "USER" && isAdmin) return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        const status = (u.status || "ACTIVE").toUpperCase();
        if (statusFilter !== status) return false;
      }

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    } catch {
      return dateString.substring(0, 10);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <Toast
        message={toast?.message || null}
        type={toast?.type}
        onClose={() => setToast(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#282828]">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-black/60 border border-[#282828] text-white">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">
                User &amp; Admin Accounts
              </h1>
              <p className="text-zinc-400 text-sm mt-0.5">
                Manage role hierarchy, account access, and security policies across registered users.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchUsers(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-zinc-300 bg-black/60 border border-[#282828] hover:bg-white hover:text-black transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#121212] rounded-3xl border border-[#282828] p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search accounts by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 text-sm rounded-xl bg-black/60 border border-[#282828] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter Tabs */}
            <div className="inline-flex p-1 rounded-full bg-black/60 border border-[#282828] text-xs font-semibold">
              {(["ALL", "ADMIN", "USER"] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3 py-1.5 rounded-full transition-all ${
                    roleFilter === role
                      ? "bg-white text-black font-bold shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {role === "ALL" ? "All Roles" : role === "ADMIN" ? "Admins" : "Users"}
                </button>
              ))}
            </div>

            {/* Status Filter Tabs */}
            <div className="inline-flex p-1 rounded-full bg-black/60 border border-[#282828] text-xs font-semibold">
              {(["ALL", "ACTIVE", "BLOCKED"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-full transition-all ${
                    statusFilter === status
                      ? "bg-white text-black font-bold shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {status === "ALL" ? "All Status" : status === "ACTIVE" ? "Active" : "Blocked"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Count overview */}
        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-[#282828]">
          <span>
            Showing <strong className="text-white">{filteredUsers.length}</strong> of{" "}
            {users.length} accounts
          </span>
          {(searchQuery || roleFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="text-white font-medium hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
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
                <SkeletonCard variant="table-row" count={6} />
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-zinc-400">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-30 text-zinc-500" />
                    <p className="font-semibold text-base text-zinc-300">
                      No accounts matched your filters
                    </p>
                    <p className="text-xs mt-1 text-zinc-500">Try adjusting your search query or role filter tabs.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
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
                                  onClick={() => handleUserAction(u, "demote")}
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
                                  onClick={() => handleUserAction(u, "promote")}
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
                              onClick={() => handleUserAction(u, isBlocked ? "unblock" : "block")}
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
                              <span className="hidden sm:inline">{isBlocked ? "Unblock" : "Block"}</span>
                            </button>
                          )}

                          {/* Delete Action */}
                          {!isSuperAdmin && !isSelf && (
                            <button
                              onClick={() => handleUserAction(u, "delete")}
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
      </div>
    </div>
  );
}
