"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Music,
  Cpu,
  Mic2,
  ListMusic,
  ShieldAlert,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "danger" | "warning" | "default";
}

const baseNavItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Songs Studio",
    href: "/songs",
    icon: Music,
  },
  {
    name: "Processing",
    href: "/jobs",
    icon: Cpu,
  },
  {
    name: "Artists",
    href: "/artists",
    icon: Mic2,
  },
  {
    name: "Playlists",
    href: "/playlists",
    icon: ListMusic,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleNavItems = [...baseNavItems];
  const roleUpper = user?.role?.toUpperCase() || "";
  const isSuperAdmin =
    roleUpper === "SUPERADMIN" || roleUpper === "SUPER_ADMIN";

  if (isSuperAdmin) {
    visibleNavItems.push({
      name: "Security & Admins",
      href: "/users",
      icon: ShieldAlert,
    });
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0d0d0f] border-r border-white/[0.08] flex flex-col z-50 select-none">
      {/* Brand & Studio Header */}
      <div className="p-5 pb-4 flex items-center justify-between border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center overflow-hidden shrink-0 border border-white/[0.12] group-hover:border-white/30 transition-all shadow-sm">
            <img
              src="/image.png"
              alt="One Melody Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              One Melody
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-white/10 text-zinc-300 rounded border border-white/15">
                Admin
              </span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono tracking-wide">
              Studio Console
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Section */}
      <div className="px-4 pt-4 pb-1">
        <span className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          Platform Management
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar py-2">
        {visibleNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150 group text-xs font-semibold ${
                isActive
                  ? "bg-white/[0.1] text-white shadow-sm font-bold"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              {/* Active Accent Indicator */}
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
              )}

              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-zinc-500 group-hover:text-zinc-300"
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </div>

              {item.badge ? (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    item.badgeVariant === "danger"
                      ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      : "bg-white/10 text-zinc-300 border-white/20"
                  }`}
                >
                  {item.badge}
                </span>
              ) : (
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform ${
                    isActive
                      ? "text-white/60 opacity-100"
                      : "text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
                  }`}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* System Telemetry Micro-Pill */}
      <div className="p-3 mx-3 mb-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-zinc-400 font-medium">Pipeline Nodes</span>
        </div>
        <span className="text-emerald-400 font-mono font-bold text-[10px] uppercase">
          Online
        </span>
      </div>

      {/* Admin Profile Footer */}
      {user && (
        <div className="p-3 border-t border-white/[0.08] bg-[#09090b]">
          <div className="p-2.5 rounded-xl bg-[#141417] border border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/15 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-inner">
              {user.name ? user.name.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-white truncate">
                {user.name || "Administrator"}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider truncate">
                  {user.role}
                </span>
                {isSuperAdmin && (
                  <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
