"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserActionType, UserItem } from "@/app/users/types";
import { useToast } from "@/components/feedback/ToastProvider";
import type { UserSession } from "@/lib/api";
import { apiGet, apiRequest, fetchPage } from "@/lib/http";
import { retryIdempotent } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { patchPages, restore } from "@/lib/query/optimistic";

export interface UserListParams {
  page: number;
  size: number;
  search: string;
  role: string;
  status: string;
}

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: queryKeys.users.list({ ...params }),
    queryFn: ({ signal }) => fetchPage<UserItem>("/admin/account", { ...params }, signal),
    placeholderData: keepPreviousData,
  });
}

type AccountAction = Exclude<UserActionType, "sessions">;

const ACTION_REQUEST: Record<AccountAction, { suffix: string; method: "POST" | "DELETE" }> = {
  promote: { suffix: "", method: "POST" },
  demote: { suffix: "/demote", method: "POST" },
  block: { suffix: "/block", method: "POST" },
  unblock: { suffix: "/unblock", method: "POST" },
  delete: { suffix: "", method: "DELETE" },
};

const ACTION_DONE: Record<AccountAction, (email: string) => string> = {
  promote: (e) => `${e} promoted to Administrator`,
  demote: (e) => `${e} demoted to Standard User`,
  block: (e) => `Account ${e} has been blocked`,
  unblock: (e) => `Account ${e} has been unblocked`,
  delete: (e) => `Account ${e} was successfully deleted`,
};

function applyAction(rows: UserItem[], email: string, action: AccountAction): UserItem[] {
  if (action === "delete") return rows.filter((u) => u.email !== email);
  return rows.map((u) => {
    if (u.email !== email) return u;
    if (action === "promote") return { ...u, role: "ADMIN" };
    if (action === "demote") return { ...u, role: "USER" };
    if (action === "block") return { ...u, status: "BLOCKED" };
    return { ...u, status: "ACTIVE" };
  });
}

/** Promote, demote, block, unblock or delete an account, applied optimistically. */
export function useUserAction() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ user, action }: { user: UserItem; action: AccountAction }) => {
      const { suffix, method } = ACTION_REQUEST[action];
      return apiRequest(`/admin/account/${encodeURIComponent(user.email)}${suffix}`, {
        method,
        errorMessage: `Action '${action}' failed`,
      });
    },
    // Every account action sets a target state, so repeating one is harmless.
    retry: retryIdempotent,
    onMutate: async ({ user, action }) => ({
      snapshot: await patchPages<UserItem>(
        qc,
        queryKeys.users.lists(),
        (rows) => applyAction(rows, user.email, action),
        action === "delete" ? -1 : 0,
      ),
    }),
    onError: (err, _v, ctx) => {
      restore(qc, ctx?.snapshot);
      toast(err.message, "error");
    },
    onSuccess: (_d, { user, action }) => toast(ACTION_DONE[action](user.email)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUserSessions(email: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.users.sessions(email ?? ""),
    queryFn: async ({ signal }) =>
      (await apiGet<{ sessions?: UserSession[] }>(`/admin/account/${encodeURIComponent(email ?? "")}/sessions`, signal))
        .sessions ?? [],
    enabled: Boolean(email),
    staleTime: 0,
  });
}

export function useRevokeSession(email: string) {
  const qc = useQueryClient();
  const key = queryKeys.users.sessions(email);
  return useMutation({
    mutationFn: (sessionId: string | "all") =>
      sessionId === "all"
        ? apiRequest(`/admin/account/${encodeURIComponent(email)}/sessions/revoke-all`, {
            method: "POST",
            errorMessage: "Failed to revoke all sessions",
          })
        : apiRequest(`/admin/account/${encodeURIComponent(email)}/sessions/${sessionId}`, {
            method: "DELETE",
            errorMessage: "Failed to revoke session",
          }),
    onMutate: async (sessionId) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<UserSession[]>(key);
      qc.setQueryData<UserSession[]>(key, (old) => (sessionId === "all" ? [] : old?.filter((s) => s.id !== sessionId)));
      return { previous };
    },
    onError: (_e, _id, ctx) => qc.setQueryData(key, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
