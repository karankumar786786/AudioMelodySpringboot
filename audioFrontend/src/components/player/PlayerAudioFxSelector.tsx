"use client";

import React from "react";
import { Sparkles, Headphones, Waves, Check } from "lucide-react";
import { PlayerTooltip } from "./PlayerTooltip";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const isAnyActive = isBassBoostEnabled || isSpatialAudioEnabled;

  const handleBassClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBassBoost();
    toast.success(
      isBassBoostEnabled
        ? "Sub-Bass Boost disabled"
        : "Sub-Bass Boost enabled (+7dB)",
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
      isSpatialAudioEnabled
        ? "3D Spatial Audio disabled"
        : "3D Spatial Audio enabled",
      {
        description: isSpatialAudioEnabled
          ? "Standard stereo audio"
          : "Virtual 3D stereo room immersion active",
      }
    );
  };

  return (
    <DropdownMenu>
      <PlayerTooltip content="Audio Enhancements (3D & Bass)">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`relative p-1.5 rounded-md transition-colors cursor-pointer focus:outline-none ${
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
        </DropdownMenuTrigger>
      </PlayerTooltip>

      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        className="w-56 p-1.5 bg-[#1c1c1c]/95 border-white/15 backdrop-blur-2xl shadow-2xl"
      >
        <DropdownMenuLabel className="px-2 py-1 text-xs font-bold text-white flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-primary" />
            <span>Audio Enhancements</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-normal">
            Real-time Web Audio DSP
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/10" />

        {/* 3D Spatial Audio Toggle */}
        <DropdownMenuItem
          onClick={handleSpatialClick}
          className={`justify-between text-xs cursor-pointer ${
            isSpatialAudioEnabled
              ? "bg-primary/15 text-primary font-semibold"
              : "text-zinc-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Headphones
              size={14}
              className={isSpatialAudioEnabled ? "text-primary" : "text-zinc-400"}
            />
            <span>3D Spatial Audio</span>
          </div>
          {isSpatialAudioEnabled && (
            <Check size={14} className="text-primary shrink-0" />
          )}
        </DropdownMenuItem>

        {/* Sub-Bass Boost Toggle */}
        <DropdownMenuItem
          onClick={handleBassClick}
          className={`justify-between text-xs cursor-pointer ${
            isBassBoostEnabled
              ? "bg-primary/15 text-primary font-semibold"
              : "text-zinc-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Waves
              size={14}
              className={isBassBoostEnabled ? "text-primary" : "text-zinc-400"}
            />
            <span>Sub-Bass Boost</span>
          </div>
          {isBassBoostEnabled && (
            <Check size={14} className="text-primary shrink-0" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
