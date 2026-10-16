"use client";

import React, { useEffect, useState, useCallback } from "react";
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
import { adminFetch } from "@/lib/adminFetch";
import { UserSession } from "@/lib/api";
import { UserItem } from "../types";

export interface UserSessionsModalProps {
  user: UserItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (message: string, type: "success" | "error") => void;
}

export const UserSessionsModal: React.FC<UserSessionsModalProps> = ({
  user,
  isOpen,
  onClose,
  onNotify,
}) => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/admin/account/${encodeURIComponent(user.email)}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.error || err?.message || "Failed to load user device sessions");
      }
    } catch (e: any) {
      setError(e.message || "Network error loading sessions");
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (isOpen && user) {
      fetchSessions();
    } else {
      setSessions([]);
      setError(null);
    }
  }, [isOpen, user, fetchSessions]);

  const handleRevokeSingle = async (sessionId: string) => {
    if (!user?.email) return;
    setRevokingId(sessionId);
    try {
      const res = await adminFetch(
        `/admin/account/${encodeURIComponent(user.email)}/sessions/${sessionId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (onNotify) onNotify("Device session revoked successfully", "success");
      } else {
        const err = await res.json().catch(() => null);
        if (onNotify) onNotify(err?.error || "Failed to revoke session", "error");
      }
    } catch (e: any) {
      if (onNotify) onNotify("Network error revoking session", "error");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!user?.email) return;
    if (!confirm(`Are you sure you want to log out all devices for ${user.email}?`)) {
      return;
    }
    setRevokingAll(true);
    try {
      const res = await adminFetch(
        `/admin/account/${encodeURIComponent(user.email)}/sessions/revoke-all`,
        { method: "POST" }
      );
      if (res.ok) {
        setSessions([]);
        if (onNotify) onNotify("All device sessions revoked successfully", "success");
      } else {
        const err = await res.json().catch(() => null);
        if (onNotify) onNotify(err?.error || "Failed to revoke all sessions", "error");
      }
    } catch (e: any) {
      if (onNotify) onNotify("Network error revoking sessions", "error");
    } finally {
      setRevokingAll(false);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#121212] border border-[#282828] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#282828] bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-[#282828] flex items-center justify-center text-white">
              <Smartphone className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Active Client Sessions
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {sessions.length} device{sessions.length !== 1 ? "s" : ""}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                User: {user.email} • ID: {user.id.slice(0, 8)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Toolbar */}
        <div className="px-6 py-3.5 bg-zinc-950/40 border-b border-[#282828] flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-400">
            Database-backed refresh sessions verified by <span className="font-semibold text-zinc-300">coreEngine</span>.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchSessions}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-300 bg-black/60 hover:bg-zinc-800 border border-[#282828] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {sessions.length > 0 && (
              <button
                onClick={handleRevokeAll}
                disabled={revokingAll || loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all disabled:opacity-50"
              >
                {revokingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                )}
                Revoke All Devices
              </button>
            )}
          </div>
        </div>

        {/* Modal Body / Sessions List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
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
                        <Smartphone className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Laptop className="w-5 h-5 text-indigo-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-white truncate">
                          {sess.deviceId}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
