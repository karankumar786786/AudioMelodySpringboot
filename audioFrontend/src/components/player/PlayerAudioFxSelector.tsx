"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Headphones, Waves, Check } from "lucide-react";
import { PlayerTooltip } from "./PlayerTooltip";
import { toast } from "sonner";

interface PlayerAudioFxSelectorProps {
  isBassBoostEnabled: boolean;
  toggleBassBoost: () => void;
  isSpatialAudioEnabled: boolean;
  toggleSpatialAudio: () => void;
}

export const PlayerAudioFxSelector: React.FC<PlayerAudioFxSelectorProps> = ({
  isBassBoostEnabled,
  toggleBassBoost,
  isSpatialAudioEnabled,
  toggleSpatialAudio,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAnyActive = isBassBoostEnabled || isSpatialAudioEnabled;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBassClick = () => {
    toggleBassBoost();
    toast.success(isBassBoostEnabled ? "Sub-Bass Boost disabled" : "Sub-Bass Boost enabled (+7dB)", {
      description: isBassBoostEnabled ? "Standard low-end profile" : "Punchy 80Hz low-shelf boost active",
    });
  };

  const handleSpatialClick = () => {
    toggleSpatialAudio();
    toast.success(isSpatialAudioEnabled ? "3D Spatial Audio disabled" : "3D Spatial Audio enabled", {
      description: isSpatialAudioEnabled ? "Standard stereo audio" : "Virtual 3D stereo room immersion active",
    });
  };

  return (
    <div className="relative" ref={menuRef}>
      <PlayerTooltip content="Audio Enhancements (3D & Bass)">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={`relative p-1.5 rounded-md transition-colors cursor-pointer ${
            isAnyActive
              ? "text-primary bg-[#282828] shadow-sm"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
          aria-label="Audio Enhancements"
        >
          <Sparkles size={16} />
          {isAnyActive && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </button>
      </PlayerTooltip>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-56 rounded-xl bg-[#1c1c1c]/95 border border-white/15 shadow-2xl p-2 z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 select-none">
          <div className="px-2 py-1.5 border-b border-white/10 mb-1">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles size={13} className="text-primary" /> Audio Enhancements
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">Real-time Web Audio FX</p>
          </div>

          <div className="space-y-1">
            {/* 3D Spatial Audio Toggle */}
            <button
              type="button"
              onClick={handleSpatialClick}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isSpatialAudioEnabled
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-zinc-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <Headphones size={14} className={isSpatialAudioEnabled ? "text-primary" : "text-zinc-400"} />
                <span>3D Spatial Audio</span>
              </div>
              {isSpatialAudioEnabled && <Check size={14} className="text-primary shrink-0" />}
            </button>

            {/* Sub-Bass Boost Toggle */}
            <button
              type="button"
              onClick={handleBassClick}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isBassBoostEnabled
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-zinc-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <Waves size={14} className={isBassBoostEnabled ? "text-primary" : "text-zinc-400"} />
                <span>Sub-Bass Boost</span>
              </div>
              {isBassBoostEnabled && <Check size={14} className="text-primary shrink-0" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
