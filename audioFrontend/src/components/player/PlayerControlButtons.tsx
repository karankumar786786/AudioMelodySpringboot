"use client";

import React from "react";
import {
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
} from "lucide-react";
import { toast } from "sonner";
import { playerActions } from "@/store/player.store";
import { PlayerTooltip } from "./PlayerTooltip";

interface PlayerControlButtonsProps {
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: "none" | "all" | "one";
  isVideoActive: boolean;
  audioElement: HTMLAudioElement | null;
}

export const PlayerControlButtons: React.FC<PlayerControlButtonsProps> = ({
  isPlaying,
  isShuffle,
  repeatMode,
  isVideoActive,
  audioElement,
}) => {
  const handlePlayPause = () => {
    if (!isVideoActive && audioElement) {
      if (isPlaying) {
        audioElement.pause();
      } else {
        audioElement.play().catch((err) => {
          if (err.name !== "AbortError")
            console.warn("[Player] Manual play failed:", err);
        });
      }
    }
    playerActions.setIsPlaying(!isPlaying);
  };

  const handleToggleRepeat = () => {
    playerActions.toggleRepeat();
    const modes: Record<string, string> = {
      none: "Repeat All",
      all: "Repeat One",
      one: "Repeat Off",
    };
    const next = modes[repeatMode] || "Repeat Off";
    toast.success(next);
  };

  return (
    <div className="flex items-center gap-5">
      <PlayerTooltip content={isShuffle ? "Disable shuffle" : "Enable shuffle"}>
        <button
          type="button"
          onClick={() => {
            playerActions.toggleShuffle();
            toast.success(isShuffle ? "Shuffle Off" : "Shuffle On");
          }}
          className={`relative flex flex-col items-center justify-center p-1.5 transition-colors cursor-pointer ${
            isShuffle ? "text-primary" : "text-zinc-400 hover:text-white"
          }`}
          aria-label={isShuffle ? "Disable shuffle" : "Enable shuffle"}
        >
          <Shuffle size={16} />
          {isShuffle && (
            <span className="absolute -bottom-0.5 w-1 h-1 bg-primary rounded-full" />
          )}
        </button>
      </PlayerTooltip>

      <PlayerTooltip content="Previous track" shortcut={["Ctrl", "←"]}>
        <button
          type="button"
          onClick={() => playerActions.previous()}
          className="text-zinc-300 hover:text-white transition-colors cursor-pointer"
          aria-label="Previous track"
        >
          <SkipBack size={18} fill="currentColor" />
        </button>
      </PlayerTooltip>

      <PlayerTooltip content={isPlaying ? "Pause" : "Play"} shortcut="Space">
        <button
          type="button"
          onClick={handlePlayPause}
          className="w-9 h-9 rounded-full bg-white text-black hover:scale-105 flex items-center justify-center cursor-pointer transition-transform shadow-md"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause size={18} fill="black" />
          ) : (
            <Play size={18} fill="black" className="translate-x-0.5" />
          )}
        </button>
      </PlayerTooltip>

      <PlayerTooltip content="Next track" shortcut={["Ctrl", "→"]}>
        <button
          type="button"
          onClick={() => playerActions.next()}
          className="text-zinc-300 hover:text-white transition-colors cursor-pointer"
          aria-label="Next track"
        >
          <SkipForward size={18} fill="currentColor" />
        </button>
      </PlayerTooltip>

      <PlayerTooltip
        content={
          repeatMode === "none"
            ? "Enable repeat"
            : repeatMode === "all"
              ? "Repeat one"
              : "Disable repeat"
        }
      >
        <button
          type="button"
          onClick={handleToggleRepeat}
          className={`relative flex flex-col items-center justify-center p-1.5 transition-colors cursor-pointer ${
            repeatMode !== "none"
              ? "text-primary"
              : "text-zinc-400 hover:text-white"
          }`}
          aria-label={`Repeat mode: ${repeatMode}`}
        >
          {repeatMode === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
          {repeatMode !== "none" && (
            <span className="absolute -bottom-0.5 w-1 h-1 bg-primary rounded-full" />
          )}
        </button>
      </PlayerTooltip>
    </div>
  );
};
