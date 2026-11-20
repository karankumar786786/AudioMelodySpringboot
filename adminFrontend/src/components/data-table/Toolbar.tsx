"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
      <input
        type="search"
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-8 py-2 bg-[#121215] border border-white/8 hover:border-white/14 focus:border-white/30 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export interface FilterOption<V extends string> {
  value: V;
  label: ReactNode;
}

/** A row of pill buttons that sets one server-side filter. */
export function SegmentedFilter<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: FilterOption<V>[];
  onChange: (value: V) => void;
}) {
  return (
    <fieldset
      className="flex items-center bg-[#141418] p-1 rounded-xl border border-white/8 text-xs"
      aria-label={label}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
            value === opt.value
              ? "bg-white text-black font-bold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </fieldset>
  );
}
