"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    name: "Songs",
    href: "/songs",
    icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
  },
  {
    name: "Processing",
    href: "/jobs",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    name: "Artists",
    href: "/artists",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    name: "Playlists",
    href: "/playlists",
    icon: "M4 6h16M4 10h16M4 14h16M4 18h16",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Only superadmin can manage other admins
  const visibleNavItems = [...navItems];
  const roleUpper = user?.role?.toUpperCase() || "";
  if (roleUpper === "SUPERADMIN" || roleUpper === "SUPER_ADMIN") {
    visibleNavItems.push({
      name: "Admins",
      href: "/users",
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z",
    });
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-black border-r border-[#282828] flex flex-col z-50">
      {/* Brand & Logo Header */}
      <div className="p-6 pb-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center overflow-hidden shrink-0 border border-[#282828]">
          <img
            src="/image.png"
            alt="One Melody Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg font-black text-white tracking-tight truncate">
            One Melody
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="px-4 py-2">
        <h3 className="px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
          Management
        </h3>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 group text-xs font-semibold ${
                isActive
                  ? "bg-[#282828] text-white font-bold shadow-sm"
                  : "text-zinc-400 hover:bg-[#181818] hover:text-white"
              }`}
            >
              <svg
                className={`w-4 h-4 transition-colors ${
                  isActive
                    ? "text-white"
                    : "text-zinc-500 group-hover:text-zinc-200"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={item.icon}
                />
              </svg>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Logged in User Profile Card */}
      {user && (
        <div className="p-4 border-t border-[#282828]">
          <div className="bg-[#121212] border border-[#282828] p-3 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white text-black font-black text-xs flex items-center justify-center shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-white truncate">
                {user.name}
              </span>
              <span className="text-[10px] text-zinc-400 capitalize truncate">
                {user.role}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
