"use client";

import {
  Home,
  Library,
  Heart,
  History,
  PlusSquare,
  Mic2,
  ListMusic,
  Users2,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "@/store/player.store";
import { toast } from "sonner";

const menuItems = [
  { icon: Home, label: "Home", href: "/home" },
  { icon: ListMusic, label: "Playlists", href: "/playlists" },
  { icon: Users2, label: "Artists", href: "/artists" },
];

const libraryItems = [
  { icon: Heart, label: "Favourites", href: "/favourites" },
  { icon: History, label: "History", href: "/history" },
];

export function LeftSidebar() {
  const pathname = usePathname();
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const queryClient = useQueryClient();
  const [hasMounted, setHasMounted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const { data: playlistsResponse, isLoading } = useQuery({
    queryKey: ["user-playlists", systemUser?.id],
    queryFn: () => musicApi.users.getPlaylists(),
    enabled: !!systemUser?.id && hasMounted,
  });

  const userPlaylists = playlistsResponse?.data?.data || [];

  const handleCreatePlaylist = async () => {
    if (!newName.trim() || !systemUser?.id) return;
    try {
      await musicApi.users.createPlaylist(newName.trim());
      toast.success("Playlist Created", {
        description: `"${newName.trim()}" has been added to your library.`,
      });
      setNewName("");
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
    } catch {
      toast.error("Failed to create playlist.");
    }
  };

  return (
    <aside className="w-64 glass-effect border-r border-white/4 flex flex-col h-screen fixed left-0 top-0 z-50 overflow-hidden">
      <div className="p-8 flex flex-col h-full bg-black/20">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-12 group cursor-pointer shrink-0">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 overflow-hidden">
            <img
              src="/image.png"
              alt="Logo"
              className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
            />
          </div>
          <span className="text-xl font-black tracking-tighter italic text-white uppercase text-glow-green">
            One Melody
          </span>
        </div>

        <div className="space-y-10 flex-1 overflow-y-auto no-scrollbar pb-10">
          {/* Main Menu */}
          <section>
            <h3 className="px-4 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-4 italic">
              Discover
            </h3>
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                    pathname === item.href
                      ? "bg-primary text-black shadow-2xl shadow-primary/20 scale-[1.02]"
                      : "text-zinc-500 hover:text-white hover:bg-white/4 border border-transparent"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>

          {/* Library Section */}
          <section>
            <h3 className="px-4 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-4 italic">
              Collection
            </h3>
            <nav className="space-y-1">
              {libraryItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                    pathname === item.href
                      ? "bg-primary text-black shadow-2xl shadow-primary/20 scale-[1.02]"
                      : "text-zinc-500 hover:text-white hover:bg-white/4 border border-transparent"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>

          {/* User Playlists */}
          <section suppressHydrationWarning>
            <div className="flex items-center justify-between px-4 mb-4">
              <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] italic">
                Your Playlists
              </h3>
              <button
                onClick={() => {
                  if (!systemUser) {
                    toast.error("Auth Required", {
                      description: "Sign in to create playlists.",
                    });
                    return;
                  }
                  setIsCreating(!isCreating);
                }}
                className="w-5 h-5 rounded-md hover:bg-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all cursor-pointer"
                title="Create Playlist"
              >
                <Plus size={14} />
              </button>
            </div>

            {isCreating && (
              <div className="mx-2 px-3 py-2 flex items-center gap-2 bg-white/5 rounded-xl border border-white/10 mb-2 transition-all">
                <input
                  autoFocus
                  type="text"
                  placeholder="Playlist name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreatePlaylist();
                    if (e.key === "Escape") {
                      setIsCreating(false);
                      setNewName("");
                    }
                  }}
                  className="bg-transparent border-none outline-none text-[11px] font-medium text-white w-full placeholder:text-zinc-600"
                />
                <button
                  onClick={handleCreatePlaylist}
                  className="text-primary hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Create"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewName("");
                  }}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <nav className="space-y-0.5">
              {!hasMounted || isLoading ? (
                <div className="space-y-2 px-2 opacity-20">
                  <div className="h-9 bg-zinc-800 rounded-xl animate-pulse" />
                  <div className="h-9 bg-zinc-800 rounded-xl animate-pulse" />
                </div>
              ) : userPlaylists.length > 0 ? (
                userPlaylists.map((playlist: any) => (
                  <Link
                    key={playlist.id}
                    href={`/playlists/${playlist.id}?type=user`}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all truncate ${
                      pathname === `/playlists/${playlist.id}`
                        ? "text-primary bg-primary/5 shadow-inner"
                        : "text-zinc-500 hover:text-white hover:bg-white/3"
                    }`}
                  >
                    <ListMusic
                      size={14}
                      className={`shrink-0 ${pathname === `/playlists/${playlist.id}` ? "opacity-100" : "opacity-30"}`}
                    />
                    <span className="truncate">{playlist.name}</span>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-3 text-[9px] text-zinc-700 font-black uppercase tracking-widest italic opacity-50">
                  {systemUser ? "No playlists" : "Sign in required"}
                </div>
              )}
            </nav>
          </section>
        </div>
      </div>
    </aside>
  );
}
