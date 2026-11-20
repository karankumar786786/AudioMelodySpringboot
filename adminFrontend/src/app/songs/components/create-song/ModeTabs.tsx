"use client";

import { Film, Music } from "lucide-react";
import type { UploadMode } from "../../types";

const TABS: { mode: UploadMode; label: string; hint: string; Icon: typeof Music }[] = [
  { mode: "audio", label: "Audio Track", hint: "(Standard)", Icon: Music },
  { mode: "videoOnly", label: "Video Only", hint: "(Auto-Audio & Canvas)", Icon: Film },
];

export function ModeTabs({
  mode,
  onChange,
  disabled,
}: {
  mode: UploadMode;
  onChange: (mode: UploadMode) => void;
  disabled: boolean;
}) {
  return (
    <div className="px-6 py-2.5 bg-black/60 border-b border-[#282828] flex gap-2" role="tablist">
      {TABS.map(({ mode: m, label, hint, Icon }) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          disabled={disabled}
          onClick={() => onChange(m)}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            mode === m ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{label}</span>
          <span className={`text-[10px] font-normal ${mode === m ? "text-zinc-600" : "text-zinc-500"}`}>{hint}</span>
        </button>
      ))}
    </div>
  );
}
