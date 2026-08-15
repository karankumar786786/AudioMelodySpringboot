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
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 select-none w-full">
      <span className="text-[11px] font-normal text-zinc-400 tabular-nums w-8 text-right">
        {formatTime(currentTime)}
      </span>

      <div className="relative h-[5px] flex-1 group cursor-pointer flex items-center">
        {/* Background Track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[3px] bg-[#383838] rounded-full" />

        {/* Buffered Bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] bg-[#484848] rounded-full transition-all pointer-events-none"
          style={{ width: `${bufferedPct}%` }}
        />

        {/* Progress Bar (Visual) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] rounded-full group-hover:h-[4px] transition-all pointer-events-none bg-primary"
          style={{
            width: `${progressPct}%`,
          }}
        />

        {/* Native Slider Input */}
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          onChange={onChange}
          className="modern-slider progress-slider"
        />
      </div>

      <span className="text-[11px] font-normal text-zinc-400 tabular-nums w-8 text-left">
        {formatTime(duration)}
      </span>
    </div>
  );
};
