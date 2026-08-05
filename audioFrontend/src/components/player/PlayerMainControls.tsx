import React from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipForward, SkipBack } from "lucide-react";

interface PlayerMainControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export const PlayerMainControls: React.FC<PlayerMainControlsProps> = ({
  isPlaying,
  isLoading,
  onPlayPause,
  onNext,
  onPrev,
}) => {
  return (
    <div className="flex items-center justify-center gap-8">
      <button
        onClick={onPrev}
        className="text-zinc-500 hover:text-white transition-colors active:scale-90"
        title="Previous"
      >
        <SkipBack size={20} fill="currentColor" />
      </button>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onPlayPause}
        className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-lg hover:shadow-xl hover:scale-105 transition-all"
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause size={22} fill="black" />
        ) : (
          <Play size={22} fill="black" className="translate-x-0.5" />
        )}
      </motion.button>

      <button
        onClick={onNext}
        className="text-zinc-500 hover:text-white transition-colors active:scale-90"
        title="Next"
      >
        <SkipForward size={20} fill="currentColor" />
      </button>
    </div>
  );
};
