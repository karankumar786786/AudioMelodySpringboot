"use client";

import React from "react";
import { Search } from "lucide-react";
import { RoleFilter, StatusFilter } from "../types";

export interface UserFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  roleFilter: RoleFilter;
  onRoleFilterChange: (role: RoleFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  totalUsers: number;
  displayedCount: number;
  page: number;
  pageSize: number;
  activeCount: number | null;
  blockedCount: number | null;
  onResetFilters: () => void;
}

export const UserFilterBar: React.FC<UserFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  totalUsers,
  displayedCount,
  page,
  pageSize,
  activeCount,
  blockedCount,
  onResetFilters,
}) => {
  const isFiltered = searchQuery || roleFilter !== "ALL" || statusFilter !== "ALL";

  return (
    <div className="bg-[#121212] border border-[#282828] rounded-3xl p-6 shadow-xl space-y-6">
      {/* Controls: Search + Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or user ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#181818] border border-[#282828] text-white placeholder-zinc-500 pl-11 pr-4 py-2.5 rounded-2xl text-sm focus:outline-none focus:border-white transition-all shadow-inner"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Role Filter */}
          <div className="flex items-center bg-[#181818] p-1 rounded-full border border-[#282828] text-xs font-semibold">
            {(["ALL", "ADMIN", "USER"] as const).map((role) => (
              <button
                key={role}
                onClick={() => onRoleFilterChange(role)}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  roleFilter === role
                    ? "bg-white text-black font-bold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {role === "ALL" ? "All Roles" : role}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center bg-[#181818] p-1 rounded-full border border-[#282828] text-xs font-semibold">
            {(["ALL", "ACTIVE", "BLOCKED"] as const).map((status) => (
              <button
                key={status}
                onClick={() => onStatusFilterChange(status)}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  statusFilter === status
                    ? "bg-white text-black font-bold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {status === "ALL" ? "All Status" : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Count overview */}
      <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-[#282828]">
        <span>
          Showing{" "}
          <strong className="text-white">
            {totalUsers === 0 || displayedCount === 0 ? 0 : page * pageSize + 1}
          </strong>{" "}
          to{" "}
          <strong className="text-white">
            {totalUsers === 0 || displayedCount === 0 ? 0 : page * pageSize + displayedCount}
          </strong>{" "}
          of <strong className="text-white">{totalUsers}</strong> accounts
          {activeCount !== null && (
            <span className="ml-2 text-zinc-500 font-mono">
              ({activeCount} active, {blockedCount ?? 0} blocked)
            </span>
          )}
        </span>
        {isFiltered && (
          <button
            onClick={onResetFilters}
            className="text-white font-medium hover:underline cursor-pointer"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
};
