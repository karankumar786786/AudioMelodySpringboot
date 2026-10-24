"use client";

import { useAppSelector } from "@/store/hooks";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heart,
  History,
  Laptop,
  ListMusic,
  LogOut,
  Sun,
  User,
  UserPen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { playerActions } from "@/store/player.store";
import type { NavbarProfileMenuProps } from "./types";

export function NavbarProfileMenu({
  onOpenProfileModal,
  onOpenDevicesModal,
}: NavbarProfileMenuProps) {
  const systemUser = useAppSelector((s) => s.auth.systemUser);
  const [mounted, setMounted] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good Morning";
    if (hrs < 18) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="flex items-center gap-4 sm:gap-5 shrink-0 pointer-events-auto ml-4">
      {mounted && !!systemUser ? (
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Sun icon & Greeting */}
          <div className="hidden sm:flex items-center gap-2 text-xs sm:text-[13px] text-zinc-300 select-none">
            <Sun size={17} className="text-zinc-300 stroke-[1.75] shrink-0" />
            <span className="truncate max-w-45 md:max-w-none">
              {getGreeting()},{" "}
              <span className="text-white font-medium capitalize">
                {systemUser?.name || "karan"}
              </span>
            </span>
          </div>

          {/* Profile Icon button with dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-white/[0.07] hover:bg-white/[0.14] backdrop-blur-md border border-white/10 hover:border-white/25 flex items-center justify-center text-zinc-300 hover:text-white transition-all shadow-md cursor-pointer focus:outline-none"
              title={systemUser?.name || "Profile"}
              aria-label="User profile"
            >
              <User size={18} />
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-[#161616] border border-[#282828] rounded-2xl shadow-2xl p-2 z-50 pointer-events-auto backdrop-blur-xl"
                >
                  <div className="px-3 py-2.5 border-b border-[#282828] mb-1">
                    <p className="text-xs font-bold text-white truncate">
                      {systemUser?.name || "User"}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {systemUser?.email || "Music Explorer"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenProfileModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <UserPen size={14} className="text-zinc-400" />
                    <span>Edit Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenDevicesModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Laptop size={14} className="text-zinc-400" />
                    <span>Connected Devices</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push("/history");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <History size={14} className="text-zinc-400" />
                    <span>Listening History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push("/my-playlists/favourites");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Heart size={14} className="text-zinc-400" />
                    <span>Favourites</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push("/playlists");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <ListMusic size={14} className="text-zinc-400" />
                    <span>Playlists</span>
                  </button>

                  <div className="border-t border-[#282828] mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        playerActions.clearSystemSession();
                        toast.success("Logged Out", {
                          description: "You have been successfully logged out.",
                        });
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors text-left cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>Log Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <button
          onClick={() => playerActions.openAuthModal()}
          className="w-9 h-9 rounded-full bg-[#181818] hover:bg-[#222222] border border-white/10 hover:border-white/25 flex items-center justify-center text-zinc-300 hover:text-white transition-all shadow-md cursor-pointer"
          title="Sign In"
        >
          <User size={18} />
        </button>
      )}
    </div>
  );
}
