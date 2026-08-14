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
    <div className="space-y-1.5 pt-2">
      <div className="relative h-[5px] group cursor-pointer flex items-center">
        {/* Background Track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[3px] bg-white/6 rounded-full" />

        {/* Buffered Bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] bg-white/10 rounded-full transition-all duration-300 pointer-events-none"
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
      <div className="flex justify-between text-[9px] font-bold text-zinc-600 tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};
