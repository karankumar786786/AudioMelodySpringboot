import React from "react";
import {
  ListMusic,
  Shuffle,
  Repeat1,
  VolumeX,
  Volume1,
  Volume2,
} from "lucide-react";
import { PlayerQualitySelector } from "./PlayerQualitySelector";

interface PlayerUtilityRowProps {
  isShuffle: boolean;
  repeatMode: string;
  queueLength: number;
  onToggleQueue: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  selectedQuality: "auto" | number;
  qualityTracks: any[];
  showQualityMenu: boolean;
  setShowQualityMenu: (show: boolean) => void;
  onSelectQuality: (quality: "auto" | number) => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (e: React.FormEvent<HTMLInputElement>) => void;
  onToggleMute: () => void;
}

export const PlayerUtilityRow: React.FC<PlayerUtilityRowProps> = ({
  isShuffle,
  repeatMode,
  queueLength,
  onToggleQueue,
  onToggleShuffle,
  onToggleRepeat,
  selectedQuality,
  qualityTracks,
  showQualityMenu,
  setShowQualityMenu,
  onSelectQuality,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}) => {
  const VolumeIcon =
    isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const volumePct = isMuted ? 0 : volume * 100;

  return (
    <div className="flex items-center justify-between px-1 gap-4 select-none">
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggleQueue}
          className="p-1.5 rounded-lg transition-all cursor-pointer text-zinc-600 hover:text-white hover:bg-white/5 relative"
          title="Open Queue"
        >
          <ListMusic size={14} />
        </button>

        <button
          onClick={onToggleShuffle}
          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
            isShuffle
              ? "text-primary bg-primary/10 shadow-[0_0_10px_rgba(120,240,142,0.1)]"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
          title="Shuffle"
        >
          <Shuffle size={14} />
        </button>

        <button
          onClick={onToggleRepeat}
          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
            repeatMode !== "none"
              ? "text-primary bg-primary/10 shadow-[0_0_10px_rgba(120,240,142,0.1)]"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
          title="Repeat Mode"
        >
          <Repeat1 size={14} />
        </button>

        <PlayerQualitySelector
          selectedQuality={selectedQuality}
          qualityTracks={qualityTracks}
          showQualityMenu={showQualityMenu}
          setShowQualityMenu={setShowQualityMenu}
          onSelectQuality={onSelectQuality}
        />
      </div>

      <div className="flex-1 flex items-center gap-2.5 min-w-25 max-w-40">
        <button
          onClick={onToggleMute}
          className="text-zinc-600 hover:text-white transition-colors shrink-0 cursor-pointer p-1 rounded hover:bg-white/5"
        >
          <VolumeIcon size={14} />
        </button>

        <div className="relative flex-1 group h-4 flex items-center">
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-0.75 bg-white/5 rounded-full" />
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 h-0.75 bg-zinc-500 rounded-full group-hover:bg-primary transition-all pointer-events-none"
            style={{ width: `${volumePct}%` }}
          />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onInput={onVolumeChange}
            className="modern-slider volume-slider"
            style={
              { "--volume-percent": `${volumePct}%` } as React.CSSProperties
            }
          />
        </div>
      </div>
    </div>
  );
};
