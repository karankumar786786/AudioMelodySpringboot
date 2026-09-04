"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@tanstack/react-store";
import { playerStore, playerActions } from "@/store/player.store";
import { Moon, Check, X, Clock, Disc } from "lucide-react";

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [5, 10, 15, 30, 45, 60];

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const sleepTimer = useStore(playerStore, (s) => s.sleepTimer);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const [customMinutes, setCustomMinutes] = useState("");
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");

  // Live countdown calculation
  useEffect(() => {
    if (!isOpen || !sleepTimer.targetTimestamp) {
      setTimeLeftStr("");
      return;
    }

    const updateCountdown = () => {
      const remainingMs = Math.max(0, sleepTimer.targetTimestamp! - Date.now());
      if (remainingMs <= 0) {
        setTimeLeftStr("Stopping soon...");
        return;
      }
      const totalSec = Math.floor(remainingMs / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setTimeLeftStr(`${m}:${s.toString().padStart(2, "0")}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isOpen, sleepTimer.targetTimestamp]);

  if (!isOpen) return null;

  const isTimerActive =
    sleepTimer.mode === "end_of_track" ||
    (sleepTimer.mode === "minutes" &&
      sleepTimer.targetTimestamp &&
      sleepTimer.targetTimestamp > Date.now());

  const handleSelectPreset = (minutes: number) => {
    playerActions.setSleepTimer(minutes, "minutes");
    onClose();
  };

  const handleSelectEndOfTrack = () => {
    playerActions.setSleepTimer(null, "end_of_track");
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMinutes, 10);
    if (!isNaN(val) && val > 0 && val <= 720) {
      playerActions.setSleepTimer(val, "minutes");
      setCustomMinutes("");
      onClose();
    }
  };

  const handleTurnOff = () => {
    playerActions.setSleepTimer(null, "minutes");
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm bg-[#161616]/95 border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-2xl p-5 overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Moon size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Sleep Timer
              </h3>
              <p className="text-[11px] text-zinc-400">
                Automatically stop playback
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close sleep timer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Active Timer Banner */}
        {isTimerActive && (
          <div className="my-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock size={16} className="text-primary animate-pulse" />
              <div>
                <p className="text-xs font-bold text-white">
                  {sleepTimer.mode === "end_of_track"
                    ? "Stopping at end of track"
                    : `Remaining: ${timeLeftStr || "Calculating..."}`}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {sleepTimer.mode === "end_of_track"
                    ? currentSong?.title || "Current song"
                    : `${sleepTimer.durationMinutes || ""} minute timer active`}
                </p>
              </div>
            </div>
            <button
              onClick={handleTurnOff}
              className="text-xs font-bold text-red-400 hover:text-red-300 hover:underline cursor-pointer px-2 py-1"
            >
              Turn Off
            </button>
          </div>
        )}

        {/* Preset Options List */}
        <div className="mt-3 space-y-1">
          {PRESETS.map((mins) => {
            const isCurrentPreset =
              sleepTimer.mode === "minutes" &&
              sleepTimer.durationMinutes === mins &&
              isTimerActive;

            return (
              <button
                key={mins}
                onClick={() => handleSelectPreset(mins)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isCurrentPreset
                    ? "bg-primary/20 text-primary border border-primary/30 font-bold"
                    : "text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{mins === 60 ? "1 hour" : `${mins} minutes`}</span>
                {isCurrentPreset && <Check size={14} className="text-primary" />}
              </button>
            );
          })}

          {/* End of Track Option */}
          <button
            onClick={handleSelectEndOfTrack}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              sleepTimer.mode === "end_of_track"
                ? "bg-primary/20 text-primary border border-primary/30 font-bold"
                : "text-zinc-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <Disc size={14} />
              <span>End of track</span>
            </div>
            {sleepTimer.mode === "end_of_track" && (
              <Check size={14} className="text-primary" />
            )}
          </button>
        </div>

        {/* Custom duration form */}
        <form
          onSubmit={handleCustomSubmit}
          className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2"
        >
          <input
            type="number"
            min="1"
            max="720"
            placeholder="Custom (minutes)"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary transition-colors"
          />
          <button
            type="submit"
            disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
            className="px-3.5 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            Set
          </button>
        </form>
      </div>
    </div>
  );
};
