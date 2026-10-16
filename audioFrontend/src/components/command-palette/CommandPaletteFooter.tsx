"use client";

import React from "react";
import { Command } from "lucide-react";

export function CommandPaletteFooter() {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950 border-t border-white/10 text-[11px] text-zinc-400 select-none">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono text-[10px]">
            ↑↓
          </kbd>{" "}
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono text-[10px]">
            ↵
          </kbd>{" "}
          Select
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono text-[10px]">
            ESC
          </kbd>{" "}
          Close
        </span>
      </div>
      <div className="flex items-center gap-1 text-zinc-500">
        <Command size={12} />
        <span>Spotlight Search</span>
      </div>
    </div>
  );
}
