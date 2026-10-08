import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, X, RotateCcw, Volume2, Sparkles, Database, Trash2 } from "lucide-react";
import { DEFAULT_BANDS, EQUALIZER_PRESETS } from "@/lib/equalizer-presets";
import { VisualizerCanvas } from "./VisualizerCanvas";
import { audioCache } from "@/lib/audio-cache";
import { toast } from "sonner";

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  gains: number[];
  selectedPreset: string;
  setBandGain: (index: number, value: number) => void;
  applyPreset: (presetId: string) => void;
  resetEq: () => void;
  isNormalizationEnabled?: boolean;
  toggleNormalization?: () => void;
}

export function EqualizerModal({
  isOpen,
  onClose,
  analyser,
  isPlaying,
  gains,
  selectedPreset,
  setBandGain,
  applyPreset,
  resetEq,
  isNormalizationEnabled = true,
  toggleNormalization,
}: EqualizerModalProps) {
  const [cacheStats, setCacheStats] = useState<{
    count: number;
    totalSizeBytes: number;
    maxBytes: number;
  }>({ count: 0, totalSizeBytes: 0, maxBytes: 80 * 1024 * 1024 });
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      audioCache.getCacheStats().then(setCacheStats);
    }
  }, [isOpen]);

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      await audioCache.clearCache();
      const updated = await audioCache.getCacheStats();
      setCacheStats(updated);
      toast.success("Audio cache cleared", {
        description: "IndexedDB chunks wiped successfully",
      });
    } catch {
      toast.error("Failed to clear audio cache");
    } finally {
      setIsClearing(false);
    }
  };
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative z-10 w-full max-w-xl rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white">
                <Sliders size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Audio Equalizer & Visualizer
                </h2>
                <p className="text-xs text-zinc-400">
                  5-Band Hardware DSP & Realtime Sound Spectrum
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-6 pt-5">
            {/* 1. Flat Sound Spectrum Visualizer with White Bars */}
            <VisualizerCanvas
              analyser={analyser}
              isPlaying={isPlaying}
              className="h-32"
            />

            {/* Audio Normalization (ReplayGain) & Audio Cache */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Loudness Normalization */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-primary" />
                    <span className="text-xs font-bold text-white">Loudness Normalization</span>
                  </div>
                  <p className="text-[10.5px] text-zinc-400 leading-tight">
                    ReplayGain DSP equalizes track volume to eliminate abrupt loudness jumps.
                  </p>
                </div>
                {toggleNormalization && (
                  <button
                    type="button"
                    onClick={toggleNormalization}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      isNormalizationEnabled ? "bg-primary" : "bg-zinc-700"
                    }`}
                    title={isNormalizationEnabled ? "Disable normalization" : "Enable normalization"}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                        isNormalizationEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* IndexedDB Offline Chunk Cache */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <Database size={13} className="text-primary" />
                    <span className="text-xs font-bold text-white">Instant Audio Cache</span>
                  </div>
                  <p className="text-[10.5px] text-zinc-400 leading-tight">
                    {(cacheStats.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB / 80 MB ({cacheStats.count} chunks)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={isClearing || cacheStats.count === 0}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="Clear cached audio chunks from IndexedDB"
                >
                  <Trash2 size={11} />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* 2. Equalizer Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <Volume2 size={13} className="text-white" />
                  Presets
                </span>
                <button
                  onClick={resetEq}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw size={11} />
                  Reset to Flat
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {EQUALIZER_PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-white text-black font-bold shadow-md"
                          : "bg-zinc-900/90 text-zinc-300 border border-white/5 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 5-Band Slider Controls */}
            <div className="rounded-xl bg-black/40 border border-white/5 p-4">
              <div className="grid grid-cols-5 gap-2 items-end">
                {DEFAULT_BANDS.map((band, idx) => {
                  const gain = gains[idx] ?? 0;
                  return (
                    <div
                      key={band.frequency}
                      className="flex flex-col items-center gap-3"
                    >
                      {/* Gain indicator badge */}
                      <span
                        className={`text-[11px] font-mono font-bold transition-colors ${
                          gain > 0
                            ? "text-white"
                            : gain < 0
                            ? "text-zinc-400"
                            : "text-zinc-500"
                        }`}
                      >
                        {gain > 0 ? `+${gain}` : gain} dB
                      </span>

                      {/* Vertical Slider */}
                      <div className="relative flex h-36 items-center justify-center">
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={gain}
                          onChange={(e) =>
                            setBandGain(idx, parseFloat(e.target.value))
                          }
                          className="h-32 w-2 appearance-none bg-zinc-800 rounded-full cursor-pointer accent-white"
                          style={{
                            writingMode: "vertical-lr",
                            direction: "rtl",
                          }}
                        />
                      </div>

                      {/* Frequency Label */}
                      <div className="text-center">
                        <p className="text-xs font-bold text-white">
                          {band.label}
                        </p>
                        <p className="text-[10px] text-zinc-500 capitalize">
                          {idx === 0
                            ? "Sub"
                            : idx === 1
                            ? "Low"
                            : idx === 2
                            ? "Mid"
                            : idx === 3
                            ? "High"
                            : "Air"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
