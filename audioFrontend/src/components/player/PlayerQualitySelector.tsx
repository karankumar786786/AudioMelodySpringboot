import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type React from "react";

export interface QualityTrack {
  index: number;
  bandwidth: number;
  label: string;
}

interface PlayerQualitySelectorProps {
  selectedQuality: "auto" | number;
  qualityTracks: QualityTrack[];
  showQualityMenu: boolean;
  setShowQualityMenu: (show: boolean) => void;
  onSelectQuality: (quality: "auto" | number) => void;
}

export const PlayerQualitySelector: React.FC<PlayerQualitySelectorProps> = ({
  selectedQuality,
  qualityTracks,
  showQualityMenu,
  setShowQualityMenu,
  onSelectQuality,
}) => {
  return (
    <div className="relative group ml-1.5">
      <button
        type="button"
        onClick={() => setShowQualityMenu(!showQualityMenu)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer text-xs font-semibold ${
          showQualityMenu
            ? "text-primary bg-[#282828]"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        <span>
          {selectedQuality === "auto"
            ? "Auto"
            : `${Math.round((selectedQuality as number) / 1000)}k`}
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 shrink-0 ${showQualityMenu ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {showQualityMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            className="absolute bottom-full left-0 mb-2 w-40 bg-[#181818] border border-[#282828] rounded-lg p-1.5 shadow-2xl z-50"
          >
            <p className="text-xs font-semibold text-zinc-400 px-2 py-1.5 border-b border-[#282828] mb-1">
              Audio Quality
            </p>
            <div className="max-h-[200px] overflow-y-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  onSelectQuality("auto");
                  setShowQualityMenu(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium transition-all mb-1 ${
                  selectedQuality === "auto"
                    ? "bg-[#282828] text-primary font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-[#282828]"
                }`}
              >
                Auto
              </button>
              {qualityTracks.map((t) => (
                <button
                  type="button"
                  key={t.bandwidth}
                  onClick={() => {
                    onSelectQuality(t.bandwidth);
                    setShowQualityMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium transition-all mb-1 ${
                    selectedQuality === t.bandwidth
                      ? "bg-[#282828] text-primary font-semibold"
                      : "text-zinc-400 hover:text-white hover:bg-[#282828]"
                  }`}
                >
                  {(() => {
                    const kbps = `${Math.round(t.bandwidth / 1000)}K`;
                    if (!t.label) return kbps;
                    const cleanLabel = t.label.trim();
                    if (
                      cleanLabel.toLowerCase().includes(kbps.toLowerCase()) ||
                      cleanLabel.toLowerCase().includes(kbps.replace("K", "k"))
                    ) {
                      return cleanLabel;
                    }
                    return `${kbps} - ${cleanLabel}`;
                  })()}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
