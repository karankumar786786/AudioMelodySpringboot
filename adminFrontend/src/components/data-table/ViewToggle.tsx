"use client";

import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "table" | "grid";

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const btn = (mode: ViewMode, label: string, Icon: typeof List) => (
    <button
      type="button"
      aria-pressed={value === mode}
      aria-label={label}
      title={label}
      onClick={() => onChange(mode)}
      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
        value === mode
          ? "bg-white text-black"
          : "text-zinc-400 hover:text-white"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
  return (
    <div className="flex items-center bg-[#141418] p-1 rounded-xl border border-white/8">
      {btn("table", "Table view", List)}
      {btn("grid", "Grid view", LayoutGrid)}
    </div>
  );
}
