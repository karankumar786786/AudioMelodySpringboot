"use client";

import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useServerTable } from "@/components/data-table/useServerTable";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import { useUserAction, useUsers } from "@/lib/queries/users";
import { UserFilterBar } from "./components/UserFilterBar";
import { UserSessionsModal } from "./components/UserSessionsModal";
import { allowedActions, userColumns } from "./components/userColumns";
import type { RoleFilter, StatusFilter, UserActionType, UserItem } from "./types";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { can } = usePermissions();
  const confirm = useConfirm();
  const toast = useToast();

  const table = useServerTable({
    initialFilters: { role: "ALL" as RoleFilter, status: "ALL" as StatusFilter },
  });
  const { pagination, filters } = table;
  const usersQuery = useUsers({
    page: pagination.pageIndex,
    size: pagination.pageSize,
    search: table.debouncedSearch,
    role: filters.role,
    status: filters.status,
  });
  const rows = usersQuery.data?.rows ?? [];
  const total = usersQuery.data?.total ?? 0;
  const meta = usersQuery.data?.meta;

  const [sessionsUser, setSessionsUser] = useState<UserItem | null>(null);
  const userAction = useUserAction();

  const handleAction = async (user: UserItem, action: UserActionType) => {
    if (action === "sessions") {
      setSessionsUser(user);
      return;
    }
    const allowed = allowedActions(user, { currentUser, can });
    if (allowed.isSelf && (action === "block" || action === "demote" || action === "delete")) {
      toast("You cannot perform destructive actions on your own active account", "error");
      return;
    }
    if (action === "delete" || action === "block") {
      const ok = await confirm(
        action === "delete"
          ? {
              title: `Delete ${user.email}?`,
              description: "The account, its sessions and its recommendation history are removed. This cannot be undone.",
              confirmLabel: "Delete account",
              destructive: true,
              typeToConfirm: user.email,
            }
          : {
              title: `Block ${user.email}?`,
              description: "The user is signed out on every device and cannot sign in until unblocked.",
              confirmLabel: "Block account",
              destructive: true,
              typeToConfirm: user.email,
            },
      );
      if (!ok) return;
    }
    userAction.mutate({ user, action });
  };

  const pending = userAction.isPending && userAction.variables
    ? { email: userAction.variables.user.email, action: userAction.variables.action as UserActionType }
    : null;

  const columns = useMemo(
    () => userColumns({ currentUser, can, pending, onAction: handleAction }),
    // biome-ignore lint/correctness/useExhaustiveDependencies: handleAction reads fresh state when called
    [currentUser, can, pending?.email, pending?.action],
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Account Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 text-zinc-300 border border-white/5">
              Admin Only
            </span>
          </div>
          <p className="text-zinc-400 mt-1 text-sm">
            Manage user accounts, assign admin privileges, and control platform access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => usersQuery.refetch()}
          disabled={usersQuery.isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-[#181818] border border-[#282828] text-white rounded-full text-sm font-medium hover:border-zinc-500 hover:bg-[#202020] transition-all disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      <UserFilterBar
        searchQuery={table.search}
        onSearchChange={table.setSearch}
        roleFilter={filters.role}
        onRoleFilterChange={(role) => table.setFilter("role", role)}
        statusFilter={filters.status}
        onStatusFilterChange={(status) => table.setFilter("status", status)}
        totalUsers={total}
        displayedCount={rows.length}
        page={pagination.pageIndex}
        pageSize={pagination.pageSize}
        activeCount={meta?.activeCount ?? null}
        blockedCount={meta?.blockedCount ?? null}
        onResetFilters={table.reset}
      />

      <DataTable<UserItem>
        columns={columns}
        data={rows}
        getRowId={(u) => u.id || u.email}
        rowCount={total}
        pagination={pagination}
        onPaginationChange={table.setPagination}
        loading={usersQuery.isPending}
        fetching={usersQuery.isFetching}
        error={usersQuery.error}
        onRetry={() => usersQuery.refetch()}
        enableRowSelection
        rowSelection={table.rowSelection}
        onRowSelectionChange={table.setRowSelection}
        renderBulkActions={() => <span className="text-zinc-400">Export the selection with Export CSV.</span>}
        exportFileName="users"
        storageKey="users"
        defaultHiddenColumns={["createdAt"]}
        itemLabel="users"
        pageSizeOptions={[5, 10, 20, 50, 100]}
      />

      <UserSessionsModal user={sessionsUser} isOpen={Boolean(sessionsUser)} onClose={() => setSessionsUser(null)} />
    </div>
  );
}
