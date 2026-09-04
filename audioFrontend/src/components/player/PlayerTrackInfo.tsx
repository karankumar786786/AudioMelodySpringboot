import React from "react";
import { Plus } from "lucide-react";
import { HeartButton } from "@/components/HeartButton";

interface PlayerTrackInfoProps {
  title: string;
  artistName: string;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onAddToPlaylist: () => void;
  isCollapsed?: boolean;
}

export const PlayerTrackInfo: React.FC<PlayerTrackInfoProps> = ({
  title,
  artistName,
  isFavourite,
  onToggleFavourite,
  onAddToPlaylist,
  isCollapsed = false,
}) => {
  return (
    <div
      className={`relative z-10 flex-1 min-w-0 transition-all duration-500 ease-in-out ${
        isCollapsed ? "p-0" : "px-6 py-2"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            className={`font-semibold text-white truncate leading-tight transition-all duration-300 ${
              isCollapsed ? "text-xs" : "text-sm"
            }`}
          >
            {title}
          </h2>
          <p
            className={`font-normal text-zinc-400 truncate transition-all duration-300 ${
              isCollapsed ? "text-[10px]" : "text-xs mt-0.5"
            }`}
          >
            {artistName}
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <HeartButton
            isFavourite={isFavourite}
            onToggle={onToggleFavourite}
            size={isCollapsed ? 14 : 16}
          />
          <button
            onClick={onAddToPlaylist}
            className="p-1.5 text-zinc-600 hover:text-primary hover:bg-white/5 rounded-lg transition-all cursor-pointer"
            title="Add to playlist"
          >
            <Plus size={isCollapsed ? 13 : 15} />
          </button>
        </div>
      </div>
    </div>
  );
};
