"use client";

import React from "react";
import { X } from "lucide-react";
import { playerActions } from "@/store/player.store";

interface ZenExitButtonProps {
  showExitButton: boolean;
  onHover: () => void;
}

export const ZenExitButton: React.FC<ZenExitButtonProps> = ({
  showExitButton,
  onHover,
}) => {
  return (
    <div
      onMouseEnter={onHover}
      className={`fixed top-4 right-4 sm:top-6 sm:right-7 z-50 transition-all duration-500 ${
        showExitButton
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-2 pointer-events-none"
      }`}
    >
      <button
        onClick={() => playerActions.closeZenMode()}
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.05) 100%), rgba(20, 20, 25, 0.45)",
          boxShadow:
            "inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.25), 0 12px 28px rgba(0, 0, 0, 0.5)",
        }}
        className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/25 text-xs font-medium text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-3xl backdrop-saturate-190 active:scale-95 hover:scale-105"
        title="Exit Zen Mode (Esc or Z)"
      >
        <span>Exit</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-black/40 rounded border border-white/15 font-mono text-white/90">
          Esc / Z
        </kbd>
        <X size={14} className="ml-0.5" />
      </button>
    </div>
  );
};
