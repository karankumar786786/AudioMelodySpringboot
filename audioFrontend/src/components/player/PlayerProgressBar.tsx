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
    <div className="flex items-center gap-2 select-none w-full">
      <span className="text-[11px] font-normal text-zinc-400 tabular-nums w-9 min-w-[36px] text-right shrink-0">
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
            className="absolute -top-7 pointer-events-none -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#181818] border border-white/15 text-[11px] font-semibold text-white shadow-xl backdrop-blur-md z-30 transition-opacity duration-150 animate-in fade-in"
            style={{ left: `${hoverX}px` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}

        <div className="relative h-[4px] group-hover:h-[6px] w-full flex items-center rounded-full overflow-hidden transition-[height] duration-150">
          {/* Background Track */}
          <div className="absolute inset-0 w-full h-full bg-[#383838] rounded-full" />

          {/* Buffered Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#484848] rounded-full pointer-events-none"
            style={{ width: `${bufferedPct}%` }}
          />

          {/* Hover preview line */}
          {hoverTime !== null && safeDuration > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/25 rounded-full pointer-events-none"
              style={{ width: `${(hoverTime / safeDuration) * 100}%` }}
            />
          )}

          {/* Progress Bar (Visual) */}
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full pointer-events-none bg-primary"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Scrubber thumb handle */}
        <div
          className="absolute w-3 h-3 bg-white rounded-full shadow-md -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20"
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

      <span className="text-[11px] font-normal text-zinc-400 tabular-nums w-9 min-w-[36px] text-left shrink-0">
        {formatTime(safeDuration)}
      </span>
    </div>
  );
};
