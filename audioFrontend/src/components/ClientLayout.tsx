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
  const [isReady, setIsReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/callback";

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("system_token") : null;
    const userStr = typeof window !== "undefined" ? localStorage.getItem("system_user") : null;
    const hasLocalSession = !!(token && userStr);

    if (hasLocalSession || systemUser) {
      if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
        router.replace("/home");
      } else {
        setIsReady(true);
      }
    } else {
      if (!isPublicRoute) {
        router.replace("/login");
      } else {
        setIsReady(true);
      }
    }
  }, [systemUser, pathname, isPublicRoute, router]);

  // Loading Screen while resolving session from local storage or redirecting
  if (
    !isReady ||
    (!systemUser && !isPublicRoute) ||
    (systemUser && (pathname === "/" || pathname === "/login" || pathname === "/signup"))
  ) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-black select-none">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden animate-pulse">
            <img
              src="/image.png"
              alt="One Melody"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  // Guest View (Login / Signup Page)
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
