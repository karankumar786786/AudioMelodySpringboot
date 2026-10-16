"use client";

import React from "react";
import { ChevronDown, History, RotateCw } from "lucide-react";

interface QueuePanelHeaderProps {
  activeTab: "queue" | "history";
  onTabChange: (tab: "queue" | "history") => void;
  upcomingCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  onClose: () => void;
}

export const QueuePanelHeader: React.FC<QueuePanelHeaderProps> = ({
  activeTab,
  onTabChange,
  upcomingCount,
  onRefresh,
  isRefreshing,
  onClose,
}) => {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#282828] bg-[#181818] shrink-0">
      <div className="flex items-center gap-1 bg-[#222222] p-0.5 rounded-lg border border-white/5">
        <button
          type="button"
          onClick={() => onTabChange("queue")}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "queue"
              ? "bg-primary text-black shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Queue ({upcomingCount})
        </button>
        <button
          type="button"
          onClick={() => onTabChange("history")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "history"
              ? "bg-primary text-black shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <History size={12} />
          <span>History</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
          title={activeTab === "history" ? "Refresh History" : "Refresh Queue"}
        >
          <RotateCw
            size={15}
            className={isRefreshing ? "animate-spin text-primary" : ""}
          />
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          title="Close panel"
        >
          <ChevronDown size={16} />
        </button>
      </div>
    </div>
  );
};
