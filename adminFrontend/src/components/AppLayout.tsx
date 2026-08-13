"use client";

import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "./GlobalSearch";
import { useAuth } from "@/lib/auth-context";
import { AuthScreen } from "./AuthScreen";
import { LogOut } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();

  console.log("AppLayout rendering");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Restrict access to admin/superadmin roles
  const roleUpper = user.role?.toUpperCase() || "";
  const isAuthorized = roleUpper === "ADMIN" || roleUpper === "SUPERADMIN" || roleUpper === "SUPER_ADMIN";
  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white font-sans p-6">
        <div className="max-w-md w-full text-center space-y-6 p-8 bg-zinc-900/60 border border-zinc-800 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-500 mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-red-400 tracking-tight">Access Denied</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Your account role (<span className="text-zinc-300 font-bold">{user.role}</span>) is not authorized to access this administration node.
          </p>
          <button
            onClick={logout}
            className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl transition-all font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 px-8 flex items-center justify-between">
          <div className="flex items-center gap-6 flex-1 max-w-xl">
            <div className="text-sm font-medium text-zinc-500 whitespace-nowrap">
              Welcome back, <span className="text-zinc-900 dark:text-white font-bold">{user.name}</span>
            </div>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-2" />
            <button
              onClick={logout}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity group text-left"
            >
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white capitalize leading-none">{user.role}</span>
                <span className="text-[10px] text-red-500 font-bold tracking-wider uppercase mt-0.5 leading-none opacity-0 group-hover:opacity-100 transition-opacity">Sign Out</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-zinc-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-red-50 dark:group-hover:bg-red-950/20 group-hover:text-red-500 transition-colors">
                <LogOut className="w-4 h-4" />
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 relative overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
