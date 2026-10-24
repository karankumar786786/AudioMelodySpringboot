"use client";

import React from "react";
import { Gauge, Check } from "lucide-react";
import { useStore } from "@tanstack/react-store";
import { playerActions, playerStore } from "@/store/player.store";
import { PlayerTooltip } from "./PlayerTooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const PlayerSpeedSelector: React.FC = () => {
  const playbackRate = useStore(playerStore, (s) => s.playbackRate || 1);

  return (
    <DropdownMenu>
      <PlayerTooltip content={`Speed: ${playbackRate}x`}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-all cursor-pointer text-xs font-semibold focus:outline-none ${
              playbackRate !== 1
                ? "text-primary bg-[#282828]"
                : "text-zinc-400 hover:text-white"
            }`}
            aria-label="Playback speed"
          >
            <Gauge size={14} />
            <span>{playbackRate}x</span>
          </button>
        </DropdownMenuTrigger>
      </PlayerTooltip>

      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        className="w-36 p-1.5 bg-[#181818]/95 border-white/10 backdrop-blur-xl shadow-2xl"
      >
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          Playback Speed
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/10" />

        {SPEED_OPTIONS.map((rate) => {
          const isSelected = playbackRate === rate;
          return (
            <DropdownMenuItem
              key={rate}
              onClick={() => playerActions.setPlaybackRate(rate)}
              className={`justify-between text-xs cursor-pointer ${
                isSelected
                  ? "bg-primary text-black font-bold focus:bg-primary focus:text-black"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span>{rate}x</span>
                {rate === 1 && (
                  <span className="text-[10px] opacity-70">(Normal)</span>
                )}
              </div>
              {isSelected && <Check size={13} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
