"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MoreHorizontal,
  Sparkles,
  Headphones,
  Waves,
  Sliders,
  Moon,
  Share2,
  Gauge,
  Check,
  Activity,
} from "lucide-react";
import { playerActions, playerStore } from "@/store/player.store";
import { useStore } from "@tanstack/react-store";
import { toast } from "sonner";
import { PlayerTooltip } from "./PlayerTooltip";

interface PlayerMoreMenuProps {
  showEqualizerModal: boolean;
  setShowEqualizerModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSleepTimerModal: React.Dispatch<React.SetStateAction<boolean>>;
  sleepTimerMode?: "minutes" | "end_of_track" | null;
  isBassBoostEnabled: boolean;
  toggleBassBoost: () => void;
  isSpatialAudioEnabled: boolean;
  toggleSpatialAudio: () => void;
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
  isBassBoostEnabled,
  toggleBassBoost,
  isSpatialAudioEnabled,
  toggleSpatialAudio,
  bufferedTime,
  currentTime,
  onOpenShare,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const playbackRate = useStore(playerStore, (s) => s.playbackRate || 1);

  // Active status badge on the 3-dot trigger button if any audio enhancements or timer are on
  const isEnhancementActive =
    isBassBoostEnabled ||
    isSpatialAudioEnabled ||
    Boolean(sleepTimerMode) ||
    playbackRate !== 1;

  const bufferedAhead = Math.max(0, bufferedTime - currentTime);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBassClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBassBoost();
    toast.success(
      isBassBoostEnabled ? "Sub-Bass Boost disabled" : "Sub-Bass Boost enabled (+7dB)",
      {
        description: isBassBoostEnabled
          ? "Standard low-end profile"
          : "Punchy 80Hz low-shelf boost active",
      }
    );
  };

  const handleSpatialClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSpatialAudio();
    toast.success(
      isSpatialAudioEnabled ? "3D Spatial Audio disabled" : "3D Spatial Audio enabled",
      {
        description: isSpatialAudioEnabled
          ? "Standard stereo audio"
          : "Virtual 3D wide soundstage active",
      }
    );
  };

  return (
    <div className="relative" ref={menuRef}>
      <PlayerTooltip content="More options">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={`relative p-2 rounded-full transition-all cursor-pointer ${
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
      </PlayerTooltip>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 bottom-full mb-3 w-72 rounded-2xl bg-[#181818]/95 border border-white/15 shadow-2xl p-2 z-50 backdrop-blur-2xl divide-y divide-white/10 select-none text-zinc-300"
          >
            {/* Section 1: Audio FX Enhancements (Bass & 3D Spatial) */}
            <div className="p-1 space-y-1.5 pb-2">
              <div className="flex items-center justify-between px-1.5 pt-0.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-primary" /> Audio Enhancements
                </span>
                {(isBassBoostEnabled || isSpatialAudioEnabled) && (
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">
                    Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <PlayerTooltip content="Immersive 3D binaural stereo field" className="w-full">
                  <button
                    type="button"
                    onClick={handleSpatialClick}
                    className={`w-full flex flex-col items-start p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSpatialAudioEnabled
                        ? "bg-primary/15 border-primary/40 text-primary shadow-sm"
                        : "bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Headphones
                        size={14}
                        className={isSpatialAudioEnabled ? "text-primary" : "text-zinc-400"}
                      />
                      {isSpatialAudioEnabled && <Check size={12} className="text-primary" />}
                    </div>
                    <span className="text-[11.5px] leading-tight">3D Spatial</span>
                  </button>
                </PlayerTooltip>

                <PlayerTooltip content="Punchy +7dB low-shelf boost at 80Hz" className="w-full">
                  <button
                    type="button"
                    onClick={handleBassClick}
                    className={`w-full flex flex-col items-start p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isBassBoostEnabled
                        ? "bg-primary/15 border-primary/40 text-primary shadow-sm"
                        : "bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Waves
                        size={14}
                        className={isBassBoostEnabled ? "text-primary" : "text-zinc-400"}
                      />
                      {isBassBoostEnabled && <Check size={12} className="text-primary" />}
                    </div>
                    <span className="text-[11.5px] leading-tight">Sub-Bass +7dB</span>
                  </button>
                </PlayerTooltip>
              </div>
            </div>

            {/* Section 2: Audio Tools (Equalizer & Sleep Timer) */}
            <div className="py-1.5 space-y-0.5">
              <PlayerTooltip content="Open 10-band graphic equalizer & spectrum visualizer" shortcut="E" className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowEqualizerModal(true);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    showEqualizerModal
                      ? "bg-white/10 text-primary font-semibold"
                      : "hover:bg-white/10 hover:text-white text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders size={14} className="text-zinc-400" />
                    <span>Equalizer & Visualizer</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">10-band</span>
                </button>
              </PlayerTooltip>

              <PlayerTooltip content="Set sleep timer to automatically pause music" className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowSleepTimerModal(true);
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

            {/* Section 3: Playback Speed & Stream Health */}
            <div className="py-1.5 space-y-2">
              {/* Playback Speed Row */}
              <div className="px-2 pt-0.5">
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
              <div className="px-2">
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

            {/* Section 4: Sharing & Community */}
            {onOpenShare && (
              <div className="py-1 space-y-0.5 pt-1.5">
                <PlayerTooltip content="Generate 9:16 Instagram Story PNG card" className="w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenShare();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-white/10 hover:text-white text-zinc-200 transition-colors cursor-pointer"
                  >
                    <Share2 size={14} className="text-primary" />
                    <span>Share Song Story Card</span>
                  </button>
                </PlayerTooltip>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

