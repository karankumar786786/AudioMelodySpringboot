"use client";

import {
  Home,
  Heart,
  ListMusic,
  Users2,
} from "lucide-react";
import { PlaylistThumbnail } from "@/components/PlaylistThumbnail";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { useStore } from "@tanstack/react-store";
import { playerStore, playerActions } from "@/store/player.store";

const menuItems = [
  { icon: Home, label: "Home", href: "/home" },
  { icon: ListMusic, label: "Playlists", href: "/playlists" },
  { icon: Users2, label: "Artists", href: "/artists" },
];

const libraryItems = [
  { icon: Heart, label: "Favourites", href: "/favourites" },
];

export function LeftSidebar() {
  const pathname = usePathname();
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    playerActions.closeLyrics();
  }, [pathname]);

  const handleSidebarClick = () => {
    playerActions.closeLyrics();
  };

  const { data: playlistsResponse, isLoading } = useQuery({
    queryKey: ["user-playlists", systemUser?.id],
    queryFn: () => musicApi.users.getPlaylists(),
    enabled: !!systemUser?.id && hasMounted,
  });

  const userPlaylists = playlistsResponse?.data?.data || [];

  return (
    <aside className="w-[260px] bg-black border-r border-[#282828] flex flex-col h-screen fixed left-0 top-0 z-50 overflow-hidden">
      <div className="pt-[var(--app-sidebar-pt,1.25rem)] px-5 pb-5 flex flex-col h-full bg-black">
        {/* Logo */}
        <div
          onClick={handleSidebarClick}
          className="flex items-center gap-3 mb-8 group cursor-pointer shrink-0 px-1"
        >
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden shrink-0">
            <img
              src="/image.png"
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xl font-black text-white tracking-tight">
            One Melody
          </span>
        </div>

        <div className="space-y-7 flex-1 overflow-y-auto no-scrollbar pb-24">
          {/* Main Menu */}
          <section>
            <h3 className="px-2 text-[12.5px] font-bold text-zinc-300 mb-2.5 uppercase tracking-wider">
              Menu
            </h3>
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={handleSidebarClick}
                  className={`flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-[15.5px] font-bold transition-all duration-200 ${
                    pathname === item.href
                      ? "bg-[#282828] text-white"
                      : "text-zinc-200 hover:text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  <item.icon
                    size={20}
                    className={`shrink-0 ${
                      pathname === item.href ? "text-primary" : "text-zinc-300"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </section>

          {/* Library Section */}
          <section>
            <h3 className="px-2 text-[12.5px] font-bold text-zinc-300 mb-2.5 uppercase tracking-wider">
              Library
            </h3>
            <nav className="space-y-1">
              {libraryItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={handleSidebarClick}
                  className={`flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-[15.5px] font-bold transition-all duration-200 ${
                    pathname === item.href
                      ? "bg-[#282828] text-white"
                      : "text-zinc-200 hover:text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  <item.icon
                    size={20}
                    className={`shrink-0 ${
                      pathname === item.href ? "text-primary" : "text-zinc-300"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </section>

          {/* User Playlists */}
          <section suppressHydrationWarning>
            <div className="px-2 mb-2.5">
              <h3 className="text-[12.5px] font-bold text-zinc-300 uppercase tracking-wider">
                Playlists
              </h3>
            </div>

            <nav className="space-y-0.5">
              {!hasMounted || isLoading ? (
                <div className="space-y-2 px-2 opacity-20">
                  <div className="h-8 bg-zinc-800 rounded-md animate-pulse" />
                  <div className="h-8 bg-zinc-800 rounded-md animate-pulse" />
                </div>
              ) : userPlaylists.length > 0 ? (
                userPlaylists.map((playlist: any) => (
                  <Link
                    key={playlist.id}
                    href={`/my-playlists/${playlist.id}`}
                    onClick={handleSidebarClick}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-[14px] font-bold transition-all ${
                      pathname === `/my-playlists/${playlist.id}`
                        ? "text-white bg-[#282828]"
                        : "text-zinc-300 hover:text-white hover:bg-[#1a1a1a]"
                    }`}
                  >
                    <PlaylistThumbnail playlist={playlist} size={40} />
                    <span className="truncate">{playlist.name}</span>
                  </Link>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-zinc-400 font-medium">
                  {systemUser ? "No playlists created" : "Sign in required"}
                </div>
              )}
            </nav>
          </section>
        </div>
      </div>
    </aside>
  );
}
