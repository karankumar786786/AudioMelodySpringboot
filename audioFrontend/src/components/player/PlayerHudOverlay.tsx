"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Volume1,
  VolumeX,
  FastForward,
  Rewind,
  Gauge,
  Percent,
} from "lucide-react";

function formatDuration(num?: number) {
  if (!num || isNaN(num) || !isFinite(num) || num < 0) return "0:00";
  const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface HudEventDetail {
  type: "volume" | "seek" | "speed";
  value?: number; // Volume (0-1) or Speed (0.5-2)
  isMuted?: boolean;
  time?: number; // Seek target time (seconds)
  duration?: number; // Total duration (seconds)
  delta?: string; // e.g. "+10s", "-10s", "50%"
}

export function showPlayerHud(detail: HudEventDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<HudEventDetail>("player-hud", { detail }));
  }
}

export const PlayerHudOverlay: React.FC = () => {
  const [hudData, setHudData] = useState<HudEventDetail | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleHudEvent = (e: Event) => {
      const customEvent = e as CustomEvent<HudEventDetail>;
      if (!customEvent.detail) return;

      setHudData(customEvent.detail);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setHudData(null);
      }, 1400);
    };

    window.addEventListener("player-hud", handleHudEvent);
    return () => {
      window.removeEventListener("player-hud", handleHudEvent);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[350] pointer-events-none select-none">
      <AnimatePresence mode="wait">
        {hudData && (
          <motion.div
            key="player-hud-pill"
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#181818]/95 border border-white/20 shadow-2xl backdrop-blur-xl text-white min-w-[200px] max-w-xs justify-center"
          >
            {/* Volume HUD */}
            {hudData.type === "volume" && (
              <>
                <div className="text-primary shrink-0">
                  {hudData.isMuted || (hudData.value ?? 0) === 0 ? (
                    <VolumeX size={18} className="text-red-400" />
                  ) : (hudData.value ?? 0) < 0.5 ? (
                    <Volume1 size={18} />
                  ) : (
                    <Volume2 size={18} />
                  )}
                </div>

                <div className="flex-1 min-w-[100px] flex items-center gap-2.5">
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 rounded-full ${
                        hudData.isMuted ? "bg-zinc-500" : "bg-primary"
                      }`}
                      style={{
                        width: `${hudData.isMuted ? 0 : Math.round((hudData.value ?? 0) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono font-semibold text-zinc-300 w-8 text-right">
                    {hudData.isMuted ? "0%" : `${Math.round((hudData.value ?? 0) * 100)}%`}
                  </span>
                </div>
              </>
            )}

            {/* Seek HUD */}
            {hudData.type === "seek" && (
              <>
                <div className="text-primary shrink-0">
                  {hudData.delta?.startsWith("-") ? (
                    <Rewind size={18} />
                  ) : (
                    <FastForward size={18} />
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold">
                  {hudData.delta && (
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-primary font-mono text-[11px]">
                      {hudData.delta}
                    </span>
                  )}
                  <span className="font-mono text-zinc-200">
                    {formatDuration(hudData.time ?? 0)}
                  </span>
                  {hudData.duration ? (
                    <span className="text-zinc-500 font-mono">
                      / {formatDuration(hudData.duration)}
                    </span>
                  ) : null}
                </div>
              </>
            )}

            {/* Speed HUD */}
            {hudData.type === "speed" && (
              <>
                <div className="text-primary shrink-0">
                  <Gauge size={18} />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <span>Speed:</span>
                  <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono">
                    {hudData.value}x
                  </span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
