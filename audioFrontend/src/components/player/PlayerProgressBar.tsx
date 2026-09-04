"use client";

import React, { useState, useRef } from "react";

interface PlayerProgressBarProps {
  currentTime: number;
  duration: number;
  bufferedTime: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const PlayerProgressBar: React.FC<PlayerProgressBarProps> = ({
  currentTime,
  duration,
  bufferedTime,
  onChange,
}) => {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const formatTime = (s: number) => {
    if (!s || isNaN(s) || !isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const safeCurrentTime = Math.max(0, isFinite(currentTime) ? currentTime : 0);
  const safeDuration = Math.max(0, isFinite(duration) ? duration : 0);

  const progressPct =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (safeCurrentTime / safeDuration) * 100))
      : 0;

  const bufferedPct =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (bufferedTime / safeDuration) * 100))
      : 0;

  const hoverPct =
    hoverTime !== null && safeDuration > 0
      ? (hoverTime / safeDuration) * 100
      : null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || safeDuration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const fraction = offsetX / rect.width;
    setHoverTime(fraction * safeDuration);
    setHoverX(offsetX);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  return (
    <div className="flex items-center gap-2.5 select-none w-full">
      <span className="text-[11px] font-medium text-zinc-400 tabular-nums w-9 min-w-[36px] text-right shrink-0">
        {formatTime(safeCurrentTime)}
      </span>

      <div
        ref={trackRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-6 flex-1 flex items-center group cursor-pointer"
      >
        {/* Hover Timestamp Tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-8 pointer-events-none -translate-x-1/2 flex flex-col items-center z-30 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: `${hoverX}px` }}
          >
            {/* Timestamp Pill */}
            <div className="px-2 py-0.5 rounded-md bg-[#181818]/95 border border-white/20 text-[11px] font-mono font-bold text-white shadow-2xl backdrop-blur-xl flex items-center gap-1.5">
              <span>{formatTime(hoverTime)}</span>
            </div>
            {/* Tooltip Chevron Indicator */}
            <div className="w-1.5 h-1.5 bg-[#181818] border-r border-b border-white/20 rotate-45 -mt-1" />
          </div>
        )}

        {/* Timeline Bar Track */}
        <div className="relative h-[4px] group-hover:h-[6px] w-full flex items-center rounded-full overflow-hidden transition-[height] duration-150 bg-[#333333]">
          {/* Buffered Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#555555] rounded-full pointer-events-none transition-all duration-150"
            style={{ width: `${bufferedPct}%` }}
          />

          {/* Hover preview line */}
          {hoverPct !== null && (
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none"
              style={{ width: `${hoverPct}%` }}
            />
          )}

          {/* Progress Fill Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full pointer-events-none bg-primary transition-all duration-75"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Scrubber thumb handle */}
        <div
          className="absolute w-3 h-3 bg-white rounded-full shadow-lg border border-black/20 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 z-20 hover:scale-110"
          style={{ left: `${progressPct}%` }}
        />

        {/* Native Slider Input */}
        <input
          type="range"
          min="0"
          max={Math.max(1, safeDuration)}
          step="0.1"
          value={Math.min(safeCurrentTime, Math.max(1, safeDuration))}
          onChange={onChange}
          aria-label="Seek track"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0 border-0 bg-transparent"
        />
      </div>

      <span className="text-[11px] font-medium text-zinc-400 tabular-nums w-9 min-w-[36px] text-left shrink-0">
        {formatTime(safeDuration)}
      </span>
    </div>
  );
};
