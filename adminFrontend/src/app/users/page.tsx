"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { adminFetch } from "@/lib/adminFetch";
import { Toast, ToastType } from "@/components/Toast";
import { RefreshCw } from "lucide-react";
import { UserItem, RoleFilter, StatusFilter, UserActionType } from "./types";
import { UserFilterBar } from "./components/UserFilterBar";
import { UsersTable } from "./components/UsersTable";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);

  // Action states: tracks which user email is undergoing which action
  const [actionLoading, setActionLoading] = useState<{ [email: string]: string }>({});

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUsers = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          size: String(pageSize),
        });
        if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
        if (roleFilter !== "ALL") params.append("role", roleFilter);
        if (statusFilter !== "ALL") params.append("status", statusFilter);

        const res = await adminFetch(`/admin/account?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const content = data.content || data.data?.content || data.data || [];
          setUsers(content);
          const meta = data.paginationMetaData || data.data?.paginationMetaData || data.metadata;
          const metaTotal = Number(meta?.totalCount ?? data.totalCount);
          let total: number;
          if (!isNaN(metaTotal) && metaTotal > 0) {
            total = metaTotal;
          } else if (content.length < pageSize) {
            total = page * pageSize + content.length;
          } else {
            total = (page + 2) * pageSize;
          }
          setTotalUsers(total);
          setActiveCount(meta?.activeCount ?? null);
          setBlockedCount(meta?.blockedCount ?? null);
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
    },
    [page, pageSize, debouncedSearch, roleFilter, statusFilter]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Execute an action on a user
  const handleUserAction = async (user: UserItem, action: UserActionType) => {
    const isSelf = user.id === currentUser?.id || user.email === currentUser?.email;
    if (isSelf && (action === "block" || action === "demote" || action === "delete")) {
      showToast("You cannot perform destructive actions on your own active account", "error");
      return;
    }

    if (action === "delete") {
      if (
        !confirm(
          `Are you sure you want to permanently delete ${user.email}? This action cannot be undone.`
        )
      ) {
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

  // Fallback client-side filter in case backend does not yet support server-side query filters
  const displayedUsers = useMemo(() => {
    return users.filter((u) => {
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchesName = (u.userName || u.name || "").toLowerCase().includes(q);
        const matchesEmail = (u.email || "").toLowerCase().includes(q);
        const matchesId = (u.id || "").toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesId) return false;
      }
      if (roleFilter !== "ALL") {
        const isAdmin =
          u.role?.toUpperCase() === "ADMIN" ||
          u.role?.toUpperCase() === "SUPERADMIN" ||
          u.role?.toUpperCase() === "SUPER_ADMIN";
        if (roleFilter === "ADMIN" && !isAdmin) return false;
        if (roleFilter === "USER" && isAdmin) return false;
      }
      if (statusFilter !== "ALL") {
        const status = (u.status || "ACTIVE").toUpperCase();
        if (statusFilter !== status) return false;
      }
      return true;
    });
  }, [users, debouncedSearch, roleFilter, statusFilter]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setPage(0);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Account Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 text-zinc-300 border border-white/5">
              Admin Only
            </span>
          </div>
          <p className="text-zinc-400 mt-1 text-sm">
            Manage user accounts, assign admin privileges, and control platform access.
          </p>
        </div>
        <button
          onClick={() => fetchUsers(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#181818] border border-[#282828] text-white rounded-full text-sm font-medium hover:border-zinc-500 hover:bg-[#202020] transition-all disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Controls: Search + Filters + Counters */}
      <UserFilterBar
        searchQuery={searchQuery}
        onSearchChange={(val) => setSearchQuery(val)}
        roleFilter={roleFilter}
        onRoleFilterChange={(role) => {
          setRoleFilter(role);
          setPage(0);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(status) => {
          setStatusFilter(status);
          setPage(0);
        }}
        totalUsers={totalUsers}
        displayedCount={displayedUsers.length}
        page={page}
        pageSize={pageSize}
        activeCount={activeCount}
        blockedCount={blockedCount}
        onResetFilters={handleResetFilters}
      />

      {/* Users Table with skeleton loading and reusable PaginationBar */}
      <UsersTable
        users={displayedUsers}
        loading={loading}
        currentUser={currentUser}
        actionLoading={actionLoading}
        onUserAction={handleUserAction}
        page={page}
        pageSize={pageSize}
        totalUsers={totalUsers}
        onPageChange={(newPage) => setPage(newPage)}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(0);
        }}
      />
    </div>
  );
}
