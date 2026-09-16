"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface PaginationBarProps {
  page: number; // 0-indexed
  pageSize: number;
  totalItems: number;
  currentCount: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  loading?: boolean;
  className?: string;
}

export function PaginationBar({
  page,
  pageSize,
  totalItems,
  currentCount,
  itemLabel = "items",
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50, 100],
  loading = false,
  className = "",
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 || currentCount === 0 ? 0 : page * pageSize + 1;
  const endItem = totalItems === 0 || currentCount === 0 ? 0 : page * pageSize + currentCount;

  const isFirstDisabled = page === 0 || loading;
  const isPrevDisabled = page === 0 || loading;
  const isNextDisabled =
    loading ||
    (currentCount < pageSize && page >= totalPages - 1) ||
    (totalItems > 0 && page >= totalPages - 1);
  const isLastDisabled =
    loading ||
    (currentCount < pageSize && page >= totalPages - 1) ||
    (totalItems > 0 && page >= totalPages - 1);

  return (
    <div
      className={`p-4 border-t border-[#282828] bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span>
          Showing <strong className="text-white font-semibold">{startItem}</strong> to{" "}
          <strong className="text-white font-semibold">{endItem}</strong> of{" "}
          <strong className="text-white font-semibold">{totalItems}</strong> {itemLabel}
        </span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
          }}
          disabled={loading}
          className="bg-[#181818] border border-[#282828] text-zinc-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer disabled:opacity-50"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt} per page
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(0)}
          disabled={isFirstDisabled}
          className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
          title="First Page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={isPrevDisabled}
          className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-3 py-1 font-mono text-zinc-300 text-xs">
          Page <strong className="text-white">{page + 1}</strong> of{" "}
          <strong className="text-white">{totalPages}</strong>
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={isNextDisabled}
          className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(Math.max(0, totalPages - 1))}
          disabled={isLastDisabled}
          className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
          title="Last Page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
