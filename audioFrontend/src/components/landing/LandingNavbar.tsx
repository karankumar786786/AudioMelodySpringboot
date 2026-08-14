"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { playerActions } from "@/store/player.store";

export function LandingNavbar() {
  const router = useRouter();

  return (
    <header
      className="fixed top-5 inset-x-6 z-50 max-w-5xl mx-auto rounded-full px-6 py-3 flex items-center justify-between bg-[#181818]/90 backdrop-blur-md border border-[#282828]"
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 cursor-pointer group"
        onClick={() => router.push("/")}
      >
        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
          <Image
            src="/image.png"
            alt="OneMelody"
            width={28}
            height={28}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="text-sm font-bold text-white tracking-tight">
          OneMelody
        </span>
      </div>

      {/* Nav links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-zinc-400">
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
        className="px-5 py-2 rounded-full text-xs font-bold cursor-pointer transition-all duration-200 hover:scale-105 bg-primary text-black"
      >
        Listen Now
      </button>
    </header>
  );
}
