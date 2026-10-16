"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { QueueBackpressureSummary } from "@/lib/api";

interface SystemStatusWidgetProps {
  queueStats?: QueueBackpressureSummary;
}

export function SystemStatusWidget({ queueStats }: SystemStatusWidgetProps) {
  const getQueuePulseColor = () => {
    switch (queueStats?.overallStatus) {
      case "DLQ_ALERT":
        return "bg-rose-500 animate-ping";
      case "HIGH":
        return "bg-red-500 animate-ping";
      case "MODERATE":
        return "bg-amber-500 animate-pulse";
      default:
        return "bg-emerald-500";
    }
  };

  const getQueueBadgeStyle = () => {
    switch (queueStats?.overallStatus) {
      case "DLQ_ALERT":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "HIGH":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "MODERATE":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
  };

  return (
    <div className="bg-[#121212] rounded-2xl border border-[#282828] p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-5 h-5 text-white" />
          <h2 className="text-base font-bold text-white">System Status</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-6">Backend services and connectivity</p>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-zinc-200">Core Engine API</span>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Online
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-zinc-200">PostgreSQL DB</span>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Connected
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-white" />
              <span className="text-xs font-semibold text-zinc-200">Audio Pipeline</span>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-200 border border-white/20">
              Ready
            </span>
          </div>

          <Link
            href="/jobs"
            className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${getQueuePulseColor()}`} />
              <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                Queue Buffer ({queueStats?.totalQueued ?? 0})
              </span>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getQueueBadgeStyle()}`}>
              {queueStats?.overallStatus || "Optimal"}
            </span>
          </Link>
        </div>
      </div>

      <div className="pt-4 mt-6 border-t border-[#282828] text-xs text-zinc-500 flex items-center justify-between">
        <span>One Melody</span>
        <span className="font-mono">Port 8080/9090</span>
      </div>
    </div>
  );
}
