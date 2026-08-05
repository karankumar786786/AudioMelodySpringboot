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
        className={`flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all cursor-pointer text-[10px] font-black italic tracking-wider ${
          showQualityMenu
            ? "text-primary bg-primary/10 shadow-[0_0_12px_rgba(120,240,142,0.15)]"
            : "text-zinc-600 hover:text-zinc-400"
        }`}
      >
        <span>
          {selectedQuality === "auto"
            ? "HD"
            : `${Math.round((selectedQuality as number) / 1000)}K`}
        </span>
        <ChevronDown
          size={10}
          className={`transition-transform duration-300 shrink-0 ${showQualityMenu ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {showQualityMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-full left-0 mb-3 w-40 glass-effect-strong border border-white/10 rounded-2xl p-2 shadow-2xl z-100"
          >
            <p className="text-xs font-semibold text-zinc-400 px-3 py-2 border-b border-white/5 mb-1.5">
              Stream Quality
            </p>
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
              <button
                type="button"
                onClick={() => {
                  onSelectQuality("auto");
                  setShowQualityMenu(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-black italic transition-all mb-1 ${
                  selectedQuality === "auto"
                    ? "bg-primary text-black"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                AUTO
              </button>
              {qualityTracks.map((t) => (
                <button
                  type="button"
                  key={t.bandwidth}
                  onClick={() => {
                    onSelectQuality(t.bandwidth);
                    setShowQualityMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-black italic transition-all mb-1 ${
                    selectedQuality === t.bandwidth
                      ? "bg-primary text-black"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
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
