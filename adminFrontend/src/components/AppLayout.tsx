"use client";

import { LogOut, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthScreen } from "./AuthScreen";
import { GlobalSearch } from "./GlobalSearch";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
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
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/20 border-t-white"></div>
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white font-sans p-6">
        <div className="max-w-md w-full text-center space-y-6 p-8 bg-[#121212] border border-[#282828] rounded-3xl shadow-2xl">
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
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <header className="h-16 border-b border-[#282828] bg-black/80 backdrop-blur-md sticky top-0 z-40 px-8 flex items-center justify-between">
          <div className="flex items-center gap-6 flex-1 max-w-xl">
            <div className="text-xs font-medium text-zinc-400 whitespace-nowrap">
              Welcome back,{" "}
              <span className="text-white font-bold">{user.name}</span>
            </div>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={logout}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#282828] transition-all text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer group"
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
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Internet connection restored. You are back online.</span>
          </div>
        )}

        <main className="flex-1 relative overflow-y-auto bg-black">
          {children}
        </main>
      </div>
    </div>
  );
}
