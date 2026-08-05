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
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  return (
    <div
      className={`relative z-10 flex-none select-none transition-all duration-500 ease-in-out ${
        isCollapsed ? "p-0" : "px-6 pt-4 pb-2"
      }`}
    >
      <div className="relative">
        {/* Glowing aura under the album art when playing - only in full size mode */}
        {!isCollapsed && isPlaying && (
          <motion.div
            layoutId="player-glow"
            animate={{
              opacity: [0.12, 0.28, 0.12],
              scale: [0.96, 1.04, 0.96],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-2 bg-primary rounded-3xl blur-[30px] pointer-events-none"
          />
        )}
        <motion.div
          layout
          key={songId}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 22, stiffness: 180 }}
          className={`overflow-hidden border border-white/8 relative z-10 shrink-0 shadow-2xl transition-all duration-500 ease-in-out ${
            isCollapsed
              ? "w-11 h-11 rounded-xl"
              : "aspect-square w-full rounded-[2rem] hover:scale-[1.02]"
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
