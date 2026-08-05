"use client";

import Image from "next/image";

export function LandingFooter() {
  return (
    <footer
      className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-white/10">
          <Image
            src="/image.png"
            alt="One Melody"
            width={20}
            height={20}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="text-xs font-medium text-zinc-500">
          © 2026 One Melody. Precision engineered sound.
        </span>
      </div>
      <div className="flex gap-5 text-[11px] font-semibold text-zinc-500">
        <a
          href="https://x.com"
          className="hover:text-primary transition-colors"
        >
          Twitter
        </a>
        <a
          href="https://github.com"
          className="hover:text-primary transition-colors"
        >
          GitHub
        </a>
        <a
          href="https://discord.com"
          className="hover:text-primary transition-colors"
        >
          Discord
        </a>
      </div>
    </footer>
  );
}
