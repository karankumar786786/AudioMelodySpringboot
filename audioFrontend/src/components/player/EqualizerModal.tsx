"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, X, RotateCcw, Volume2, Waves, Zap, Compass } from "lucide-react";
import { DEFAULT_BANDS, EQUALIZER_PRESETS } from "@/lib/equalizer-presets";
import { VisualizerCanvas } from "./VisualizerCanvas";
import { SpatialPreset } from "./hooks/useWebAudio";

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
  // Spatial & FX props
  bassBoost?: number;
  setBassBoost?: (level: number) => void;
  spatialPreset?: SpatialPreset;
  setSpatialPreset?: (preset: SpatialPreset) => void;
  panPosition?: number;
  setPanPosition?: (pos: number) => void;
  crossfadeDuration?: number;
  setCrossfadeDuration?: (sec: number) => void;
  crossfadeCurve?: "constant_power" | "linear";
  setCrossfadeCurve?: (curve: "constant_power" | "linear") => void;
}

type TabType = "eq" | "spatial" | "bass" | "dj";

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
  bassBoost = 0,
  setBassBoost,
  spatialPreset = "off",
  setSpatialPreset,
  panPosition = 0,
  setPanPosition,
  crossfadeDuration = 0.5,
  setCrossfadeDuration,
  crossfadeCurve = "constant_power",
  setCrossfadeCurve,
}: EqualizerModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("eq");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 select-none">
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
          className="relative z-10 w-full max-w-xl rounded-3xl border border-white/10 bg-[#121212]/95 p-6 shadow-2xl overflow-hidden backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-400">
                <Sliders size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Pro Audio FX & Equalizer
                </h2>
                <p className="text-xs text-zinc-400">
                  Hardware DSP Equalizer, 3D Spatial Audio & DJ Controls
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] border border-white/5 rounded-2xl mt-4">
            <button
              onClick={() => setActiveTab("eq")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "eq"
                  ? "bg-white text-black shadow-lg"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Sliders size={14} />
              <span>Equalizer</span>
            </button>
            <button
              onClick={() => setActiveTab("spatial")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "spatial"
                  ? "bg-white text-black shadow-lg"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Compass size={14} />
              <span>3D Spatial</span>
            </button>
            <button
              onClick={() => setActiveTab("bass")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "bass"
                  ? "bg-white text-black shadow-lg"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Zap size={14} />
              <span>Bass Boost</span>
            </button>
            <button
              onClick={() => setActiveTab("dj")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dj"
                  ? "bg-white text-black shadow-lg"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Waves size={14} />
              <span>DJ Crossfade</span>
            </button>
          </div>

          {/* Tab Body */}
          <div className="pt-5 space-y-6">
            {/* Live Spectrum Visualizer (always active across tabs) */}
            <VisualizerCanvas
              analyser={analyser}
              isPlaying={isPlaying}
              className="h-28"
            />

            {/* TAB 1: EQUALIZER */}
            {activeTab === "eq" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Volume2 size={13} className="text-white" />
                    Acoustic Presets
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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

                {/* 5-Band Sliders */}
                <div className="rounded-2xl bg-black/40 border border-white/5 p-4">
                  <div className="grid grid-cols-5 gap-2 items-end">
                    {DEFAULT_BANDS.map((band, idx) => {
                      const gain = gains[idx] ?? 0;
                      return (
                        <div
                          key={band.frequency}
                          className="flex flex-col items-center gap-2"
                        >
                          <span
                            className={`text-[11px] font-mono font-bold transition-colors ${
                              gain > 0
                                ? "text-purple-400"
                                : gain < 0
                                ? "text-zinc-400"
                                : "text-zinc-500"
                            }`}
                          >
                            {gain > 0 ? `+${gain}` : gain} dB
                          </span>

                          <div className="relative flex h-32 items-center justify-center">
                            <input
                              type="range"
                              min="-12"
                              max="12"
                              step="1"
                              value={gain}
                              onChange={(e) =>
                                setBandGain(idx, parseFloat(e.target.value))
                              }
                              className="h-28 w-2 appearance-none bg-zinc-800 rounded-full cursor-pointer accent-purple-400"
                              style={{
                                writingMode: "vertical-lr",
                                direction: "rtl",
                              }}
                            />
                          </div>

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
            )}

            {/* TAB 2: 3D SPATIAL & REVERB */}
            {activeTab === "spatial" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-300">Room Acoustic Simulation</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "off", name: "Off", icon: "🚫" },
                      { id: "studio", name: "Studio Room", icon: "🎙️" },
                      { id: "club", name: "Live Club", icon: "🍸" },
                      { id: "concert", name: "Concert Hall", icon: "🏟️" },
                      { id: "cathedral", name: "Grand Cathedral", icon: "⛪" },
                    ].map((room) => {
                      const isSelected = spatialPreset === room.id;
                      return (
                        <button
                          key={room.id}
                          onClick={() => setSpatialPreset && setSpatialPreset(room.id as SpatialPreset)}
                          className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-purple-500/20 border-purple-500/50 text-white shadow-lg"
                              : "bg-white/[0.02] border-white/5 text-zinc-300 hover:bg-white/[0.05]"
                          }`}
                        >
                          <span className="text-xl">{room.icon}</span>
                          <span className="text-xs font-bold">{room.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Left/Right Stereo Panning */}
                {setPanPosition && (
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-300">Stereo Balance (Pan)</span>
                      <span className="font-mono text-zinc-400">
                        {panPosition === 0 ? "Center" : panPosition < 0 ? `L ${Math.round(Math.abs(panPosition) * 100)}%` : `R ${Math.round(panPosition * 100)}%`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500 font-bold">L</span>
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        value={panPosition}
                        onChange={(e) => setPanPosition(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                      />
                      <span className="text-xs text-zinc-500 font-bold">R</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BASS BOOST */}
            {activeTab === "bass" && setBassBoost && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Zap size={16} className="text-amber-400" />
                        Bass Maximizer Drive
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Sub-bass dynamic expansion for headphones and sound systems
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono font-bold text-sm">
                      {Math.round(bassBoost)}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={bassBoost}
                    onChange={(e) => setBassBoost(parseFloat(e.target.value))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />

                  <div className="flex justify-between text-[11px] text-zinc-500 font-semibold">
                    <span>Off (0%)</span>
                    <span>Punchy (50%)</span>
                    <span>Max +12dB (100%)</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: DJ CROSSFADE */}
            {activeTab === "dj" && setCrossfadeDuration && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Waves size={16} className="text-cyan-400" />
                        Smart Track Crossfade
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Smooth transition overlap between queue tracks
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono font-bold text-sm">
                      {crossfadeDuration.toFixed(1)}s
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="0.5"
                    value={crossfadeDuration}
                    onChange={(e) => setCrossfadeDuration(parseFloat(e.target.value))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />

                  <div className="flex justify-between text-[11px] text-zinc-500 font-semibold">
                    <span>Gapless (0s)</span>
                    <span>Standard (3s)</span>
                    <span>Club Mix (12s)</span>
                  </div>

                  {setCrossfadeCurve && (
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-300">Crossfade Curve</span>
                      <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5">
                        <button
                          onClick={() => setCrossfadeCurve("constant_power")}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            crossfadeCurve === "constant_power"
                              ? "bg-cyan-500 text-black font-bold"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          Constant Power
                        </button>
                        <button
                          onClick={() => setCrossfadeCurve("linear")}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            crossfadeCurve === "linear"
                              ? "bg-cyan-500 text-black font-bold"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          Linear Fade
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
