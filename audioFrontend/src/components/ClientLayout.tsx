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
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { tokenStorage } from "@/lib/api/client";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const isLyricsOpen = useStore(playerStore, (s) => s.isLyricsOpen);
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/callback";

  const isAuthFormRoute =
    pathname === "/" || pathname === "/login" || pathname === "/signup";

  // Hydrate user from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const token = tokenStorage.getAccessToken();
    if (token) {
      if (!playerStore.state.systemUser) {
        const stored = localStorage.getItem("system_user");
        if (stored) {
          try {
            const user = JSON.parse(stored);
            playerStore.setState((s) => ({
              ...s,
              systemUser: user,
            }));
          } catch {}
        }
      }
    } else {
      playerStore.setState((s) => ({
        ...s,
        systemUser: null,
      }));
    }
  }, []);

  // Listen for session cleared event (logout, 401 refresh failure)
  useEffect(() => {
    const handleSessionCleared = () => {
      playerStore.setState((s) => ({ ...s, systemUser: null }));
      if (!isPublicRoute) {
        router.replace("/signup?session_expired=1");
      }
    };
    window.addEventListener("session:cleared", handleSessionCleared);
    return () => window.removeEventListener("session:cleared", handleSessionCleared);
  }, [isPublicRoute, router]);

  // Handle client-side routing & auth guard
  useEffect(() => {
    if (!mounted) return;
    const token = tokenStorage.getAccessToken();
    const hasSession = Boolean(
      token && (systemUser || (typeof window !== "undefined" && localStorage.getItem("system_user")))
    );

    if (hasSession) {
      if (isAuthFormRoute) {
        router.replace("/home");
      } else {
        setIsReady(true);
      }
    } else {
      if (!isPublicRoute) {
        router.replace("/signup");
      } else {
        setIsReady(true);
      }
    }
  }, [mounted, systemUser, pathname, isPublicRoute, isAuthFormRoute, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true;
      if (isStandalone) {
        document.documentElement.setAttribute("data-standalone", "true");
      } else {
        document.documentElement.removeAttribute("data-standalone");
      }
    };
    checkStandalone();
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", checkStandalone);
    return () => media.removeEventListener?.("change", checkStandalone);
  }, []);

  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [pathname]);

  const currentUser = mounted ? systemUser : null;

  // Loading Screen while resolving session or redirecting
  if (
    !isReady ||
    (!currentUser && !isPublicRoute) ||
    (currentUser && isAuthFormRoute)
  ) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-black select-none">
        <NetworkStatusBanner />
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center overflow-hidden animate-pulse">
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
  if (!currentUser) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-black overflow-y-auto">
        <NetworkStatusBanner />
        <AuthModal />
        {isPublicRoute ? children : null}
      </div>
    );
  }

  // Authenticated Full View (Structured Unified Navbar & 3-Panel Layout)
  return (
    <>
      <NetworkStatusBanner />
      <AuthModal />
      <div className="fixed inset-0 pointer-events-none z-0 bg-black" />

      {/* Unified Top Navbar across full screen */}
      <AppNavbar />

      <LeftSidebar />
      <section
        id="main-section"
        className="flex-1 flex flex-col min-w-0 ml-0 md:ml-16 xl:ml-48 mr-0 lg:mr-72.5 xl:mr-80 2xl:mr-85 overflow-hidden relative z-10 bg-black transition-[margin] duration-200"
      >
        <main
          className={`flex-1 ${
            isLyricsOpen ? "overflow-hidden pointer-events-none invisible" : "overflow-y-auto"
          } no-scrollbar pt-16 pb-24`}
        >
          {children}
        </main>
      </section>
      <RightInfoPanel />
      <HlsMusicPlayer />
    </>
  );
}
