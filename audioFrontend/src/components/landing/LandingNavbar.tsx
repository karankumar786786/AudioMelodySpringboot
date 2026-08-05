"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { playerActions } from "@/store/player.store";

export function LandingNavbar() {
  const router = useRouter();

  return (
    <header
      className="fixed top-5 inset-x-6 z-50 max-w-5xl mx-auto rounded-full px-6 py-3 flex items-center justify-between"
      style={{
        background: "rgba(10,12,10,0.80)",
        backdropFilter: "blur(24px) saturate(1.6)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.40)",
      }}
    >
      {/* Logo */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Logo click navigation */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Logo click navigation */}
      <div
        className="flex items-center gap-2.5 cursor-pointer group"
        onClick={() => router.push("/")}
      >
        <div className="w-7 h-7 rounded-full overflow-hidden group-hover:scale-105 transition-transform duration-300 ring-1 ring-white/10 shadow-sm">
          <Image
            src="/image.png"
            alt="One Melody"
            width={28}
            height={28}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="text-[13px] font-bold tracking-widest text-white/80 italic uppercase">
          ONE MELODY
        </span>
      </div>

      {/* Nav links */}
      <nav className="hidden md:flex items-center gap-7 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
        <a
          href="#features"
          className="hover:text-white transition-colors duration-150"
        >
          Features
        </a>
        <a
          href="#specs"
          className="hover:text-white transition-colors duration-150"
        >
          Specs
        </a>
        <a
          href="#faq"
          className="hover:text-white transition-colors duration-150"
        >
          FAQ
        </a>
      </nav>

      {/* CTA */}
      <button
        type="button"
        onClick={() => playerActions.openAuthModal()}
        className="px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-200 active:scale-95 bg-primary text-black hover:brightness-110"
        style={{ boxShadow: "0 0 16px rgba(120,240,142,0.25)" }}
      >
        Listen Now
      </button>
    </header>
  );
}
