"use client";

import { useStore } from "@tanstack/react-store";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNavbar } from "@/components/AppNavbar";
import { AuthModal } from "@/components/AuthModal";
import { HlsMusicPlayer } from "@/components/HlsMusicPlayer";
import { LeftSidebar } from "@/components/LeftSidebar";
import { playerStore } from "@/store/player.store";

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

  useEffect(() => {
    if (!mounted) return;
    const isLanding = pathname === "/" || pathname === "/callback";
    if (!isLanding && systemUser) {
      document.body.classList.add("app-zoom-95");
    } else {
      document.body.classList.remove("app-zoom-95");
    }
    return () => {
      document.body.classList.remove("app-zoom-95");
    };
  }, [mounted, systemUser, pathname]);

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-black">
        <div className="animate-pulse text-zinc-500 font-medium text-lg italic">
          Initializing Audio...
        </div>
      </div>
    );
  }

  const isPublicRoute = pathname === "/" || pathname === "/callback";

  // Guest View (Landing Page)
  if (!systemUser) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-zinc-950 overflow-y-auto">
        <AuthModal />
        {isPublicRoute ? children : null}
      </div>
    );
  }

  // Authenticated Full View
  return (
    <>
      <AuthModal />
      {/* Floating Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-black">
        <div
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/8 rounded-full blur-[120px] ambient-drift"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/4 rounded-full blur-[150px] ambient-drift"
          style={{ animationDelay: "-8s" }}
        />
        <div
          className="absolute top-[40%] left-[30%] w-[35%] h-[35%] bg-green-500/3 rounded-full blur-[100px] ambient-drift"
          style={{ animationDelay: "-16s" }}
        />
      </div>

      <LeftSidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-64 overflow-hidden relative z-10">
        <AppNavbar />
        <main className="flex-1 overflow-y-auto no-scrollbar pt-2 pb-32">
          {children}
        </main>
      </div>
      <HlsMusicPlayer />
    </>
  );
}
