"use client";

import React, { useState } from "react";
import {
  MoreHorizontal,
  Sliders,
  Moon,
  Share2,
  Gauge,
  Activity,
} from "lucide-react";
import { playerActions, playerStore } from "@/store/player.store";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { openModal } from "@/store/slices/uiSlice";
import { useStore } from "@tanstack/react-store";
import { PlayerTooltip } from "./PlayerTooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BorderBeam } from "@/components/ui/border-beam";

interface PlayerMoreMenuProps {
  showEqualizerModal?: boolean;
  setShowEqualizerModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSleepTimerModal?: React.Dispatch<React.SetStateAction<boolean>>;
  sleepTimerMode?: "minutes" | "end_of_track" | null;
  isBassBoostEnabled?: boolean;
  toggleBassBoost?: () => void;
  isSpatialAudioEnabled?: boolean;
  toggleSpatialAudio?: () => void;
  bufferedTime: number;
  currentTime: number;
  onOpenShare?: () => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export const PlayerMoreMenu: React.FC<PlayerMoreMenuProps> = ({
  showEqualizerModal,
  setShowEqualizerModal,
  setShowSleepTimerModal,
  sleepTimerMode,
  bufferedTime,
  currentTime,
  onOpenShare,
}) => {
  const dispatch = useAppDispatch();
  const activeModal = useAppSelector((s) => s.ui.activeModal);
  const [isOpen, setIsOpen] = useState(false);

  const isEqualizerOpen = showEqualizerModal ?? (activeModal === "equalizer");
  const playbackRate = useStore(playerStore, (s) => s.playbackRate || 1);

  // Active status badge on the 3-dot trigger button if any enhancements or timer are on
  const isEnhancementActive =
    Boolean(sleepTimerMode) || playbackRate !== 1;

  const bufferedAhead = Math.max(0, bufferedTime - currentTime);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PlayerTooltip content="More options">
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`relative p-2 rounded-full transition-all cursor-pointer focus:outline-none ${
              isOpen
                ? "text-white bg-white/15"
                : isEnhancementActive
                  ? "text-primary bg-[#282828]"
                  : "text-zinc-400 hover:text-white hover:bg-[#282828]"
            }`}
            aria-label="More player options"
          >
            <MoreHorizontal size={18} />
            {isEnhancementActive && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-black animate-pulse" />
            )}
          </button>
        </PopoverTrigger>
      </PlayerTooltip>

      <PopoverContent
        align="end"
        side="top"
        sideOffset={10}
        className="w-72 divide-y divide-white/10 p-2 shadow-2xl relative overflow-hidden"
      >
        <BorderBeam size={140} duration={8} colorFrom="#1ed760" colorTo="#38bdf8" />

        {/* Section 1: Audio Tools (Equalizer & Sleep Timer) */}
        <div className="py-1.5 space-y-0.5">
          <PlayerTooltip content="Open 10-band graphic equalizer & spectrum visualizer" shortcut="E" className="w-full">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                dispatch(openModal("equalizer"));
                setShowEqualizerModal?.(true);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isEqualizerOpen
                  ? "bg-white/10 text-primary font-semibold"
                  : "hover:bg-white/10 hover:text-white text-zinc-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders size={14} className="text-zinc-400" />
                <span>Equalizer & Visualizer</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">5-band</span>
            </button>
          </PlayerTooltip>

          <PlayerTooltip content="Set sleep timer to automatically pause music" className="w-full">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                dispatch(openModal("sleepTimer"));
                setShowSleepTimerModal?.(true);
              }}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-white/10 hover:text-white text-zinc-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Moon
                  size={14}
                  className={sleepTimerMode ? "text-primary" : "text-zinc-400"}
                />
                <span>Sleep Timer</span>
              </div>
              {sleepTimerMode ? (
                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  Active
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400">Off</span>
              )}
            </button>
          </PlayerTooltip>
        </div>

        {/* Section 2: Playback Speed & Stream Health */}
        <div className="py-2 space-y-2">
          {/* Playback Speed Row */}
          <div className="px-1.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <Gauge size={12} /> Playback Speed
              </span>
              <span className="text-[11px] font-semibold text-primary">
                {playbackRate}x
              </span>
            </div>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
              {SPEED_OPTIONS.map((rate) => (
                <PlayerTooltip key={rate} content={`Set speed to ${rate}x`} className="flex-1">
                  <button
                    type="button"
                    onClick={() => playerActions.setPlaybackRate(rate)}
                    className={`w-full py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                      playbackRate === rate
                        ? "bg-primary text-black font-bold shadow-sm"
                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {rate}x
                  </button>
                </PlayerTooltip>
              ))}
            </div>
          </div>

          {/* Stream Buffer Status Info */}
          <div className="px-1.5">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
              <span className="flex items-center gap-1.5 font-medium">
                <Activity
                  size={12}
                  className={
                    bufferedAhead >= 5
                      ? "text-emerald-400"
                      : bufferedAhead >= 1.5
                        ? "text-amber-400"
                        : "text-rose-400"
                  }
                />
                Stream Buffer Health
              </span>
              <span className="font-mono text-zinc-300 font-semibold">
                +{bufferedAhead.toFixed(1)}s ahead
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Sharing */}
        <div className="py-1 space-y-0.5 pt-1.5">
          <PlayerTooltip content="Generate 9:16 Instagram Story PNG card" className="w-full">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                dispatch(openModal("shareSong"));
                onOpenShare?.();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-white/10 hover:text-white text-zinc-200 transition-colors cursor-pointer"
            >
              <Share2 size={14} className="text-primary" />
              <span>Share Song Story Card</span>
            </button>
          </PlayerTooltip>
        </div>
      </PopoverContent>
    </Popover>
  );
};
