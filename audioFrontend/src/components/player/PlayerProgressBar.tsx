import React from "react";

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

  return (
    <div className="flex items-center gap-2 select-none w-full">
      <span className="text-[11px] font-normal text-zinc-400 tabular-nums w-9 min-w-[36px] text-right shrink-0">
        {formatTime(safeCurrentTime)}
      </span>

      <div className="relative h-[5px] flex-1 group cursor-pointer flex items-center overflow-hidden rounded-full">
        {/* Background Track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[3px] bg-[#383838] rounded-full" />

        {/* Buffered Bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] bg-[#484848] rounded-full pointer-events-none"
          style={{ width: `${bufferedPct}%` }}
        />

        {/* Progress Bar (Visual) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] rounded-full group-hover:h-[4px] transition-[height] duration-150 pointer-events-none bg-primary"
          style={{
            width: `${progressPct}%`,
          }}
        />

        {/* Native Slider Input (Completely invisible thumb & track overlay) */}
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
