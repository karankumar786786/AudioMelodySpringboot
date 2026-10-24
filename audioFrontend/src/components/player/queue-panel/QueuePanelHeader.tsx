"use client";

import React from "react";
import { ChevronDown, History, ListMusic, RotateCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 bg-[#161616]/95 backdrop-blur-md shrink-0">
      <Tabs
        value={activeTab}
        onValueChange={(val) => onTabChange(val as "queue" | "history")}
        className="w-auto"
      >
        <TabsList className="h-8 bg-white/5 border border-white/5 p-0.5 gap-1">
          <TabsTrigger
            value="queue"
            className="h-7 px-2.5 text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:font-semibold"
          >
            <ListMusic size={13} />
            <span>Queue</span>
            {upcomingCount > 0 && (
              <Badge
                variant="outline"
                className="h-4 px-1 text-[10px] bg-black/20 border-black/20 text-inherit font-mono leading-none"
              >
                {upcomingCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="history"
            className="h-7 px-2.5 text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:font-semibold"
          >
            <History size={13} />
            <span>History</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
            size={14}
            className={isRefreshing ? "animate-spin text-primary" : ""}
          />
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close panel"
        >
          <ChevronDown size={15} />
        </button>
      </div>
    </div>
  );
};
