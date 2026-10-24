"use client";

import { useAppSelector } from "@/store/hooks";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { playerActions } from "@/store/player.store";
import { musicApi } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { NavbarProfileMenuProps } from "./types";

export function NavbarProfileMenu({
  onOpenProfileModal,
  onOpenDevicesModal,
}: NavbarProfileMenuProps) {
  const systemUser = useAppSelector((s) => s.auth.systemUser);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good Morning";
    if (hrs < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const initials =
    (systemUser?.name || "User")
      .split(" ")
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

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

          {/* Profile Dropdown using shadcn DropdownMenu & Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                title={systemUser?.name || "Profile"}
                aria-label="User profile"
              >
                <Avatar className="w-9 h-9 border border-white/15 hover:border-white/30 transition-colors shadow-md">
                  <AvatarImage
                    src={(systemUser as any)?.avatarUrl || ""}
                    alt={systemUser?.name || "User"}
                  />
                  <AvatarFallback className="bg-white/10 text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-56 p-2 bg-[#161616]/95 border-white/10 backdrop-blur-2xl shadow-2xl"
            >
              <DropdownMenuLabel className="px-2 py-1.5 flex flex-col gap-0.5">
                <p className="text-xs font-bold text-white truncate">
                  {systemUser?.name || "User"}
                </p>
                <p className="text-[11px] text-zinc-400 font-normal truncate">
                  {systemUser?.email || "Music Explorer"}
                </p>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="bg-white/10" />

              <DropdownMenuItem
                onClick={onOpenProfileModal}
                className="gap-2.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                <UserPen size={14} className="text-zinc-400" />
                <span>Edit Profile</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={onOpenDevicesModal}
                className="gap-2.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                <Laptop size={14} className="text-zinc-400" />
                <span>Connected Devices</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => router.push("/history")}
                className="gap-2.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                <History size={14} className="text-zinc-400" />
                <span>Listening History</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => router.push("/my-playlists/favourites")}
                className="gap-2.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                <Heart size={14} className="text-zinc-400" />
                <span>Favourites</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => router.push("/playlists")}
                className="gap-2.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                <ListMusic size={14} className="text-zinc-400" />
                <span>Playlists</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-white/10" />

              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await musicApi.auth.logout();
                  } catch {
                    playerActions.clearSystemSession();
                  }
                  toast.success("Logged Out", {
                    description: "You have been successfully logged out.",
                  });
                }}
                className="gap-2.5 text-xs font-semibold text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
              >
                <LogOut size={14} />
                <span>Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
