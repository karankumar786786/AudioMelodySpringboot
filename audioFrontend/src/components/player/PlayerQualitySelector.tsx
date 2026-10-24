"use client";

import React from "react";
import { ChevronDown, Check } from "lucide-react";
import { PlayerTooltip } from "./PlayerTooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  onSelectQuality,
}) => {
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
    <DropdownMenu>
      <PlayerTooltip content={`Audio Quality: ${currentDetails.fullName}`}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 focus:outline-none"
            aria-label="Audio Quality Selector"
          >
            <span className="text-[11px]">{currentDetails.icon}</span>
            <span>{currentDetails.label}</span>
            <ChevronDown size={12} className="transition-transform duration-200 shrink-0" />
          </button>
        </DropdownMenuTrigger>
      </PlayerTooltip>

      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        className="w-56 p-1.5 bg-[#181818]/95 backdrop-blur-xl border-white/15 shadow-2xl"
      >
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          Audio Stream Quality
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          onClick={() => onSelectQuality("auto")}
          className={`justify-between text-xs cursor-pointer ${
            selectedQuality === "auto"
              ? "bg-primary text-black font-bold focus:bg-primary focus:text-black"
              : "text-zinc-300 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span>Auto (Adaptive)</span>
          </div>
          {selectedQuality === "auto" && <Check size={13} />}
        </DropdownMenuItem>

        {qualityTracks.map((t) => {
          const isSelected = selectedQuality === t.bandwidth;
          const details = getQualityDetails(t.bandwidth);

          return (
            <DropdownMenuItem
              key={t.bandwidth}
              onClick={() => onSelectQuality(t.bandwidth)}
              className={`justify-between text-xs cursor-pointer ${
                isSelected
                  ? "bg-primary text-black font-bold focus:bg-primary focus:text-black"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{details.icon}</span>
                <span>{details.fullName}</span>
              </div>
              {isSelected && <Check size={13} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
