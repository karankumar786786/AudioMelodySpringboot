"use client";

import React, { useState } from "react";
import { Zap, Activity, Wifi } from "lucide-react";

interface PlayerStreamHealthBadgeProps {
  bufferedTime: number;
  currentTime: number;
  selectedQuality: "auto" | number;
  qualityTracks: Array<{ index: number; bandwidth: number; label: string }>;
}

export const PlayerStreamHealthBadge: React.FC<PlayerStreamHealthBadgeProps> = ({
  bufferedTime,
  currentTime,
  selectedQuality,
  qualityTracks,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const safeCurrent = Math.max(0, isFinite(currentTime) ? currentTime : 0);
  const safeBuffered = Math.max(0, isFinite(bufferedTime) ? bufferedTime : 0);
  const bufferedAhead = Math.max(0, Math.round(safeBuffered - safeCurrent));

  const activeTrack =
    selectedQuality === "auto"
      ? null
      : qualityTracks.find((t) => t.index === selectedQuality);

  const qualityLabel = activeTrack
    ? activeTrack.label
    : "Auto (Adaptive)";

  const isHealthy = bufferedAhead >= 15;
  const isModerate = bufferedAhead >= 5 && bufferedAhead < 15;

  const dotColor = isHealthy
    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
    : isModerate
      ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
      : "bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]";

  return (
    <div
      className="relative hidden lg:inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/80 border border-white/10 text-[10px] font-mono text-zinc-300 cursor-default select-none transition-colors hover:border-white/20">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span className="font-semibold text-zinc-200">{bufferedAhead}s</span>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2.5 rounded-xl bg-[#181818]/95 border border-white/15 shadow-2xl backdrop-blur-xl z-50 text-[11px] select-none animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-2 border-b border-white/10 pb-1">
            <Activity size={13} className="text-primary" /> Stream Health
          </div>

          <div className="space-y-1 text-zinc-300">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Buffered ahead:</span>
              <span className="font-mono font-semibold text-white">{bufferedAhead} sec</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Quality:</span>
              <span className="font-semibold text-primary">{qualityLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Protocol:</span>
              <span className="font-mono text-zinc-300">HLS / AAC</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Status:</span>
              <span className={`font-semibold ${isHealthy ? "text-emerald-400" : isModerate ? "text-amber-400" : "text-red-400"}`}>
                {isHealthy ? "Optimal" : isModerate ? "Buffering" : "Low Buffer"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
