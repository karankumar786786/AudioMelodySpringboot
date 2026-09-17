"use client";

import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Radio, Check } from "lucide-react";
import { PlayerTooltip } from "./PlayerTooltip";

export interface QualityTrack {
  index: number;
  bandwidth: number;
  label: string;
}

interface PlayerQualitySelectorProps {
  selectedQuality: "auto" | number;
  qualityTracks: QualityTrack[];
  showQualityMenu?: boolean;
  setShowQualityMenu?: (show: boolean) => void;
  onSelectQuality: (quality: "auto" | number) => void;
}

export const PlayerQualitySelector: React.FC<PlayerQualitySelectorProps> = ({
  selectedQuality,
  qualityTracks,
  showQualityMenu: controlledShow,
  setShowQualityMenu: controlledSetShow,
  onSelectQuality,
}) => {
  const [internalShow, setInternalShow] = useState(false);
  const isControlled = typeof controlledShow === "boolean" && controlledSetShow !== undefined;
  const isOpen = isControlled ? controlledShow : internalShow;
  const setIsOpen = isControlled ? controlledSetShow : setInternalShow;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  const getQualityDetails = (q: "auto" | number) => {
    if (q === "auto") {
      return {
        label: "Auto",
        fullName: "Auto (Adaptive ABR)",
        badge: "✨ Adaptive",
        icon: "✨",
        color: "text-purple-400",
      };
    }
    const num = Number(q);
    if (num >= 256000) {
      return {
        label: `${Math.round(num / 1000)}k`,
        fullName: `${Math.round(num / 1000)} kbps High Fidelity`,
        badge: "⚡ 320k Hi-Fi",
        icon: "⚡",
        color: "text-amber-400",
      };
    }
    if (num >= 128000) {
      return {
        label: `${Math.round(num / 1000)}k`,
        fullName: `${Math.round(num / 1000)} kbps Standard`,
        badge: "🎧 128k HQ",
        icon: "🎧",
        color: "text-emerald-400",
      };
    }
    return {
      label: `${Math.round(num / 1000)}k`,
      fullName: `${Math.round(num / 1000)} kbps Data Saver`,
      badge: "🍃 64k Saver",
      icon: "🍃",
      color: "text-sky-400",
    };
  };

  const currentDetails = getQualityDetails(selectedQuality);

  return (
    <div className="relative group" ref={containerRef}>
      <PlayerTooltip content={`Audio Quality: ${currentDetails.fullName}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer text-xs font-semibold ${
            isOpen
              ? "text-primary bg-[#282828]"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
          aria-label="Audio Quality Selector"
        >
          <span className="text-[11px]">{currentDetails.icon}</span>
          <span>{currentDetails.label}</span>
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </PlayerTooltip>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2.5 w-52 bg-[#181818]/95 backdrop-blur-xl border border-white/15 rounded-xl p-1.5 shadow-2xl z-50 select-none"
          >
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10 mb-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Audio Stream Quality
              </span>
            </div>
            <div className="max-h-[240px] overflow-y-auto no-scrollbar space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onSelectQuality("auto");
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedQuality === "auto"
                    ? "bg-primary text-black font-bold"
                    : "text-zinc-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>✨</span>
                  <span>Auto (Adaptive)</span>
                </div>
                {selectedQuality === "auto" && <Check size={13} />}
              </button>
              {qualityTracks.map((t) => {
                const isSelected = selectedQuality === t.bandwidth;
                const details = getQualityDetails(t.bandwidth);

                return (
                  <button
                    type="button"
                    key={t.bandwidth}
                    onClick={() => {
                      onSelectQuality(t.bandwidth);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary text-black font-bold"
                        : "text-zinc-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{details.icon}</span>
                      <span>{details.fullName}</span>
                    </div>
                    {isSelected && <Check size={13} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

