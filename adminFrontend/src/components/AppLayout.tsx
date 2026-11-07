"use client";

import { LogOut, WifiOff, Plus, Radio } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAudio } from "@/lib/audio-context";
import { AuthScreen } from "./AuthScreen";
import { GlobalSearch } from "./GlobalSearch";
import { Sidebar } from "./Sidebar";
import { MiniAudioDock } from "./audio/MiniAudioDock";
import { CanvasPreviewModal } from "./audio/CanvasPreviewModal";
import { StatusPill } from "./ui/StatusPill";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { currentTrack } = useAudio();
  const [isOffline, setIsOffline] = useState(false);
  const [backOnlineBanner, setBackOnlineBanner] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleOnline = () => {
      setIsOffline(false);
      setBackOnlineBanner(true);
      timer = setTimeout(() => setBackOnlineBanner(false), 3500);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setBackOnlineBanner(false);
    };

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
      clearTimeout(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080809] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white" />
          <span className="text-xs text-zinc-500 font-mono tracking-wider">
            INITIALIZING WORKSPACE...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Restrict access to admin/superadmin roles
  const roleUpper = user.role?.toUpperCase() || "";
  const isAuthorized =
    roleUpper === "ADMIN" ||
    roleUpper === "SUPERADMIN" ||
    roleUpper === "SUPER_ADMIN";

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#080809] text-white font-sans p-6">
        <div className="max-w-md w-full text-center space-y-6 p-8 bg-[#121215] border border-white/[0.08] rounded-3xl shadow-2xl">
          <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-500 mb-2">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            Access Denied
          </h1>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Your account role (
            <span className="text-white font-bold">{user.role}</span>) is not
            authorized to access this administration node.
          </p>
          <button
            type="button"
            onClick={logout}
            className="w-full py-3.5 bg-white hover:bg-zinc-200 text-black rounded-xl transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-white/5"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#080809] text-white">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/[0.08] bg-[#0a0a0c]/85 backdrop-blur-xl sticky top-0 z-40 px-8 flex items-center justify-between">
          <div className="flex items-center gap-6 flex-1 max-w-xl">
            <div className="text-xs font-medium text-zinc-400 whitespace-nowrap">
              Welcome back,{" "}
              <span className="text-white font-bold">{user.name}</span>
            </div>
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-4">
            {/* Live Infrastructure Node Indicator */}
            <StatusPill status="online" label="Cluster Active" size="xs" />

            {/* Quick Upload Action */}
            <Link
              href="/songs"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Catalog</span>
            </Link>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141417] hover:bg-[#1c1c21] border border-white/[0.08] hover:border-white/[0.14] transition-all text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer group"
              title="Sign Out"
            >
              <span className="text-[11px] font-bold text-zinc-400 group-hover:text-white">
                Sign Out
              </span>
              <LogOut className="w-3.5 h-3.5 text-zinc-400 group-hover:text-rose-400 transition-colors" />
            </button>
          </div>
        </header>

        {isOffline && (
          <div className="bg-rose-500/15 border-b border-rose-500/30 text-rose-300 px-8 py-2.5 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200 shrink-0">
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                You are currently offline. File uploads and network requests may
                fail until your connection is restored.
              </span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 shrink-0">
              Offline
            </span>
          </div>
        )}

        {backOnlineBanner && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 px-8 py-2 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Internet connection restored. You are back online.</span>
          </div>
        )}

        <main
          className={`flex-1 relative overflow-y-auto bg-[#080809] custom-scrollbar ${
            currentTrack ? "pb-28" : "pb-12"
          }`}
        >
          {children}
        </main>
      </div>

      {/* Persistent Audio Preview Bar & Video Canvas Modal */}
      <MiniAudioDock />
      <CanvasPreviewModal />
    </div>
  );
}
