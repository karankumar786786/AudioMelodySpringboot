"use client";

import Link from "next/link";

export function NavbarBrand() {
  return (
    <div className="w-16 xl:w-48 shrink-0 h-full px-2 xl:px-3 flex items-center">
      <Link
        href="/home"
        className="flex items-center gap-2.5 px-1 group cursor-pointer"
        title="One Melody"
      >
        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden shrink-0 border border-white/10 group-hover:border-white/20 transition-all">
          <img
            src="/image.png"
            alt="Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <span className="hidden xl:inline text-base xl:text-lg font-bold text-white tracking-tight group-hover:text-white/90 transition-colors">
          One Melody
        </span>
      </Link>
    </div>
  );
}
