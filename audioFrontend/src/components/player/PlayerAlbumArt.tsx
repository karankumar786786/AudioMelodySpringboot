import React from "react";
import { motion } from "framer-motion";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "../../store/player.store";

interface PlayerAlbumArtProps {
  songId: string;
  posterUrl: string;
  title: string;
  isCollapsed?: boolean;
}

export const PlayerAlbumArt: React.FC<PlayerAlbumArtProps> = ({
  songId,
  posterUrl,
  title,
  isCollapsed = false,
}) => {
  return (
    <div
      className={`relative z-10 flex-none select-none transition-all duration-300 ${
        isCollapsed ? "p-0" : "px-6 pt-6 pb-2"
      }`}
    >
      <div className="relative">
        <motion.div
          layout
          key={songId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={`overflow-hidden border border-[#282828] relative z-10 shrink-0 shadow-md transition-all duration-300 ${
            isCollapsed
              ? "w-10 h-10 rounded-md"
              : "aspect-square w-full rounded-md"
          }`}
        >
          <img
            src={posterUrl}
            className="w-full h-full object-cover"
            alt={title}
          />
        </motion.div>
      </div>
    </div>
  );
};
