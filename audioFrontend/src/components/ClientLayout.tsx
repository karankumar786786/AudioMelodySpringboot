"use client";

import { useStore } from "@tanstack/react-store";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNavbar } from "@/components/AppNavbar";
import { AuthModal } from "@/components/AuthModal";
import { HlsMusicPlayer } from "@/components/HlsMusicPlayer";
import { LeftSidebar } from "@/components/LeftSidebar";
import { playerStore } from "@/store/player.store";
import { RightInfoPanel } from "@/components/RightInfoPanel";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (
      mounted &&
      !systemUser &&
      pathname !== "/" &&
      pathname !== "/callback"
    ) {
      router.replace("/");
    }
  }, [mounted, systemUser, pathname, router]);



  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-black">
        <div className="animate-pulse text-zinc-400 font-medium text-sm">
          Loading OneMelody...
        </div>
      </div>
    );
  }

  const isPublicRoute = pathname === "/" || pathname === "/callback";

  // Guest View (Landing Page)
  if (!systemUser) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-black overflow-y-auto">
        <AuthModal />
        {isPublicRoute ? children : null}
      </div>
    );
  }

  // Authenticated Full View (Spotify 3-Panel Layout)
  return (
    <>
      <AuthModal />
      <div className="fixed inset-0 pointer-events-none z-0 bg-black" />

      <LeftSidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-[260px] mr-80 overflow-hidden relative z-10 bg-black">
        <AppNavbar />
        <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
          {children}
        </main>
      </div>
      <RightInfoPanel />
      <HlsMusicPlayer />
    </>
  );
}
