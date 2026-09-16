"use client";
import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";

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
  const [pendingNav, setPendingNav] = useState<
    "first" | "prev" | "next" | "last" | null
  >(null);

  // Clear pending navigation once loading finishes
  useEffect(() => {
    if (!loading) {
      setPendingNav(null);
    }
  }, [loading]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 || currentCount === 0 ? 0 : page * pageSize + 1;
  const endItem =
    totalItems === 0 || currentCount === 0 ? 0 : page * pageSize + currentCount;

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

  const handleNav = (
    targetPage: number,
    navType: "first" | "prev" | "next" | "last"
  ) => {
    if (loading || targetPage === page) return;
    setPendingNav(navType);
    onPageChange(targetPage);
  };

  return (
    <div
      className={`relative overflow-hidden p-4 border-t border-[#282828] bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400 ${className}`}
    >
      {/* Top Animated Loading Pulse Bar */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-400 animate-pulse z-10" />
      )}

      {/* Left: Item Counter and Page Size Select */}
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
          className="bg-[#181818] border border-[#282828] text-zinc-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt} per page
            </option>
          ))}
        </select>
      </div>

      {/* Right: Navigation Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handleNav(0, "first")}
          disabled={isFirstDisabled}
          className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
          title="First Page"
        >
          {loading && pendingNav === "first" ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          ) : (
            <ChevronsLeft className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => handleNav(Math.max(0, page - 1), "prev")}
          disabled={isPrevDisabled}
          className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
          title="Previous Page"
        >
          {loading && pendingNav === "prev" ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Page Indicator with Live Spinner */}
        <span className="px-3 py-1 font-mono text-zinc-300 text-xs flex items-center gap-1.5 min-w-[110px] justify-center select-none">
          {loading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 shrink-0" />
          )}
          <span>
            Page <strong className="text-white">{page + 1}</strong> of{" "}
            <strong className="text-white">{totalPages}</strong>
          </span>
        </span>

        <button
          onClick={() => handleNav(page + 1, "next")}
          disabled={isNextDisabled}
          className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
          title="Next Page"
        >
          {loading && pendingNav === "next" ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => handleNav(Math.max(0, totalPages - 1), "last")}
          disabled={isLastDisabled}
          className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
          title="Last Page"
        >
          {loading && pendingNav === "last" ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          ) : (
            <ChevronsRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
