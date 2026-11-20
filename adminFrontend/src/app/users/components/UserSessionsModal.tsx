"use client";

import type React from "react";
import {
  Smartphone,
  Laptop,
  Shield,
  Trash2,
  X,
  RefreshCw,
  Loader2,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { useRevokeSession, useUserSessions } from "@/lib/queries/users";
import type { UserItem } from "../types";

export interface UserSessionsModalProps {
  user: UserItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserSessionsModal: React.FC<UserSessionsModalProps> = ({ user, isOpen, onClose }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const sessionsQuery = useUserSessions(isOpen ? user?.email : null);
  const revoke = useRevokeSession(user?.email ?? "");
  const sessions = sessionsQuery.data ?? [];
  const loading = sessionsQuery.isFetching;
  const error = sessionsQuery.error?.message ?? null;
  const fetchSessions = () => sessionsQuery.refetch();
  const revokingAll = revoke.isPending && revoke.variables === "all";
  const revokingId = revoke.isPending && revoke.variables !== "all" ? revoke.variables : null;

  const handleRevokeSingle = (sessionId: string) =>
    revoke.mutate(sessionId, {
      onSuccess: () => toast("Device session revoked successfully"),
      onError: (err) => toast(err.message, "error"),
    });

  const handleRevokeAll = async () => {
    if (!user?.email) return;
    const ok = await confirm({
      title: `Sign out every device for ${user.email}?`,
      description: "All of this user's sessions end; they must sign in again on each device.",
      confirmLabel: "Revoke all",
      destructive: true,
      typeToConfirm: "revoke all",
    });
    if (!ok) return;
    revoke.mutate("all", {
      onSuccess: () => toast("All device sessions revoked successfully"),
      onError: (err) => toast(err.message, "error"),
    });
  };

  if (!isOpen || !user) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#121215] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/8 bg-[#0e0e11]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center text-white">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Active Client Sessions
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                  {sessions.length} device{sessions.length !== 1 ? "s" : ""}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                User: {user.email} • ID: {user.id.slice(0, 8)}...
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/6 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Toolbar */}
        <div className="px-6 py-3 bg-[#141418] border-b border-white/6 flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-400">
            Database-backed refresh sessions verified by <span className="font-semibold text-zinc-200">coreEngine</span>.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchSessions}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-300 bg-[#18181c] hover:bg-white hover:text-black border border-white/8 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={handleRevokeAll}
                disabled={revokingAll || loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {revokingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>Revoke All Devices</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body / Sessions List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
              <p className="text-xs">Querying user active sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30 text-zinc-400" />
              <p className="font-semibold text-sm text-zinc-300">No active device sessions</p>
              <p className="text-xs mt-1 text-zinc-500">
                This user has no active refresh tokens registered in PostgreSQL.
              </p>
            </div>
          ) : (
            sessions.map((sess) => {
              const isMobile =
                sess.deviceId.toLowerCase().includes("android") ||
                sess.deviceId.toLowerCase().includes("ios") ||
                sess.deviceId.toLowerCase().includes("mobile");
              const isCurrentRevoking = revokingId === sess.id;

              return (
                <div
                  key={sess.id}
                  className="group bg-black/60 rounded-2xl border border-[#282828] p-4 flex items-center justify-between gap-4 hover:border-zinc-700 hover:bg-zinc-900/40 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-[#282828] flex items-center justify-center shrink-0">
                      {isMobile ? (
                        <Smartphone className="w-5 h-5 text-white" />
                      ) : (
                        <Laptop className="w-5 h-5 text-zinc-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-white truncate">
                          {sess.deviceId}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-white/10 text-white border border-white/20">
                          Active
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-zinc-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-500" />
                          Created: {formatDate(sess.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          Expires: {formatDate(sess.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevokeSingle(sess.id)}
                    disabled={isCurrentRevoking || revokingAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-300 hover:text-rose-400 bg-zinc-900 hover:bg-rose-500/10 border border-[#282828] hover:border-rose-500/30 transition-all shrink-0 disabled:opacity-40"
                    title="Force logout this device"
                  >
                    {isCurrentRevoking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-zinc-500 group-hover:text-rose-400" />
                    )}
                    <span>Revoke</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#282828] bg-black/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
