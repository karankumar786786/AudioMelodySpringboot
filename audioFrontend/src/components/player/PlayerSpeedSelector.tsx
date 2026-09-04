"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge } from "lucide-react";
import { useStore } from "@tanstack/react-store";
import { playerActions, playerStore } from "@/store/player.store";
import { PlayerTooltip } from "./PlayerTooltip";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const PlayerSpeedSelector: React.FC = () => {
  const playbackRate = useStore(playerStore, (s) => s.playbackRate || 1);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative group">
      <PlayerTooltip content={`Speed: ${playbackRate}x`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-all cursor-pointer text-xs font-semibold ${
            playbackRate !== 1 || isOpen
              ? "text-primary bg-[#282828]"
              : "text-zinc-400 hover:text-white"
          }`}
          aria-label="Playback speed"
        >
          <Gauge size={14} />
          <span>{playbackRate}x</span>
        </button>
      </PlayerTooltip>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              className="absolute bottom-full right-0 mb-2 w-36 bg-[#181818] border border-[#282828] rounded-lg p-1 shadow-2xl z-50 backdrop-blur-xl"
            >
              <p className="text-[11px] font-semibold text-zinc-400 px-2 py-1 border-b border-[#282828] mb-1">
                Playback Speed
              </p>
              <div className="max-h-[220px] overflow-y-auto no-scrollbar space-y-0.5">
                {SPEED_OPTIONS.map((rate) => {
                  const isSelected = playbackRate === rate;
                  return (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        playerActions.setPlaybackRate(rate);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-primary text-black font-bold"
                          : "text-zinc-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span>{rate}x</span>
                      {rate === 1 && (
                        <span className="text-[10px] opacity-70">Normal</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
