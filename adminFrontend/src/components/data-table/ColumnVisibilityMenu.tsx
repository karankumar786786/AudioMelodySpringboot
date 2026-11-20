"use client";

import type { Table } from "@tanstack/react-table";
import { Columns3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ColumnVisibilityMenu<T>({ table }: { table: Table<T> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const columns = table.getAllLeafColumns().filter((c) => c.getCanHide());

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#141418] hover:bg-[#1a1a20] border border-white/8 text-zinc-300 hover:text-white cursor-pointer"
      >
        <Columns3 className="w-3.5 h-3.5" />
        <span>Columns</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-52 rounded-xl border border-white/10 bg-[#16161a] p-1.5 shadow-2xl"
        >
          {columns.map((column) => {
            const h = column.columnDef.header;
            const label =
              column.columnDef.meta?.label ??
              (typeof h === "string" ? h : column.id);
            return (
              <label
                key={column.id}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/6 cursor-pointer"
              >
                <input
                  type="checkbox"
                  role="menuitemcheckbox"
                  aria-checked={column.getIsVisible()}
                  checked={column.getIsVisible()}
                  onChange={column.getToggleVisibilityHandler()}
                  className="rounded border-zinc-700 bg-zinc-900"
                />
                <span>{label}</span>
              </label>
            );
          })}
          <button
            type="button"
            onClick={() => table.resetColumnVisibility()}
            className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] text-zinc-500 hover:bg-white/6 hover:text-white"
          >
            Reset columns
          </button>
        </div>
      )}
    </div>
  );
}
