"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Music2, Radio, Sparkles, Waves } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { playerActions } from "@/store/player.store";

const lyrics = [
  "Lost in the echo of a fading light",
  "Chasing shadows through the endless night",
  "Every heartbeat writes a different song",
  "In the silence, I knew all along",
  "We were made from the same broken sky",
  "Two horizons learning how to fly",
  "Your voice carries across the frozen sea",
  "And the stars align, just you and me",
  "Dancing through the corridors of time",
  "Every moment feels like it was mine",
  "Breathe it in — the world can wait",
  "We'll write our story before it's too late",
  "Underneath the cathedral of sound",
  "I was lost until you came around",
  "Let the melody carry us away",
  "Into forever, past the break of day",
];

const BARS = 38;
const INTERVAL_MS = 2800;

function useSimLoop(total: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const lyricId = setInterval(
      () => setIndex((i) => (i + 1) % total),
      intervalMs,
    );
    const progId = setInterval(() => {
      const totalMs = total * intervalMs;
      const ms = (Date.now() - startRef.current) % totalMs;
      setProgress((ms / totalMs) * 100);
      setElapsed(ms / 1000);
    }, 80);
    return () => {
      clearInterval(lyricId);
      clearInterval(progId);
    };
  }, [total, intervalMs]);

  return { index, progress, elapsed };
}

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Animated EQ bars
function EqBars({ active }: { active: boolean }) {
  const [heights, setHeights] = useState(() =>
    Array.from({ length: BARS }, () => Math.random() * 60 + 15),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setHeights(Array.from({ length: BARS }, () => Math.random() * 70 + 15));
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-end gap-[2px] w-full h-full">
      {heights.map((h, i) => (
        <motion.div
          // biome-ignore lint/suspicious/noArrayIndexKey: EQ bar index is static
          key={i}
          animate={{ height: active ? `${h}%` : `${h * 0.2}%` }}
          transition={{ duration: 0.18 + (i % 4) * 0.04, ease: "easeOut" }}
          className="flex-1 rounded-full"
          style={{
            background: `linear-gradient(to top, rgba(120,240,142,0.6) 0%, rgba(52,211,153,0.9) 50%, rgba(120,240,142,0.4) 100%)`,
            minWidth: "2px",
          }}
        />
      ))}
    </div>
  );
}

// Floating particle
function Particle({ delay }: { delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: Math.random() * 3 + 1.5,
        height: Math.random() * 3 + 1.5,
        left: `${Math.random() * 100}%`,
        bottom: "0%",
        background: "rgba(120,240,142,0.5)",
        boxShadow: "0 0 6px rgba(120,240,142,0.6)",
      }}
      animate={{
        y: [0, -(Math.random() * 120 + 60)],
        opacity: [0, 0.8, 0],
        x: [0, (Math.random() - 0.5) * 40],
      }}
      transition={{
        duration: Math.random() * 3 + 2.5,
        repeat: Infinity,
        delay: delay,
        ease: "easeOut",
      }}
    />
  );
}

export function LandingHero() {
  const {
    index: activeIndex,
    progress,
    elapsed,
  } = useSimLoop(lyrics.length, INTERVAL_MS);
  const totalSecs = (lyrics.length * INTERVAL_MS) / 1000;
  const offsets = [-2, -1, 0, 1, 2];

  return (
    <main className="max-w-6xl mx-auto px-6 pt-28 md:pt-36 pb-16 relative z-10 flex flex-col items-center">
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em]"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Sparkles className="w-3 h-3 text-primary" />
        Precision Audio • HLS Streaming
      </motion.div>

      {/* Heading */}
      <div className="text-center max-w-3xl space-y-5 mb-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[0.92] text-white"
        >
          Acoustic Depth.
          <br />
          <span
            className="italic"
            style={{
              background:
                "linear-gradient(90deg, var(--primary) 0%, #34d399 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Impeccably Synced.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="text-base text-zinc-500 max-w-lg mx-auto leading-relaxed"
        >
          Decoded natively. Streamed adaptively. Real-time lyric sync with
          zero-buffer adaptive HLS audio.
        </motion.p>
      </div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
        className="flex flex-col sm:flex-row items-center gap-3 mb-16"
      >
        <button
          type="button"
          onClick={() => playerActions.openAuthModal()}
          className="px-7 py-3.5 rounded-xl bg-primary text-black font-bold text-sm hover:brightness-110 transition-all active:scale-95 flex items-center gap-2 group cursor-pointer"
          style={{
            boxShadow:
              "0 0 24px rgba(120,240,142,0.25), 0 4px 16px rgba(0,0,0,0.30)",
          }}
        >
          Enter Console
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
        <a
          href="#features"
          className="px-7 py-3.5 rounded-xl text-sm font-bold text-zinc-500 hover:text-white transition-colors cursor-pointer"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Explore Features
        </a>
      </motion.div>

      {/* ── Premium Lyrics Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-4xl"
      >
        <div
          className="relative rounded-[2.5rem] overflow-hidden"
          style={{
            background:
              "linear-gradient(160deg, #0c0e0c 0%, #080a08 60%, #0a0e0a 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow:
              "0 0 0 1px rgba(120,240,142,0.06), 0 40px 120px rgba(0,0,0,0.50), 0 1px 0 rgba(255,255,255,0.06) inset",
          }}
        >
          {/* Big ambient top glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(120,240,142,0.14), transparent 65%)",
            }}
          />
          {/* Side glows */}
          <div
            className="absolute -left-20 top-1/2 -translate-y-1/2 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(120,240,142,0.07), transparent 70%)",
            }}
          />
          <div
            className="absolute -right-20 top-1/2 -translate-y-1/2 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(52,211,153,0.05), transparent 70%)",
            }}
          />

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 14 }).map((_, i) => (
              <Particle
                // biome-ignore lint/suspicious/noArrayIndexKey: Particle index is static
                key={i}
                delay={i * 0.35}
              />
            ))}
          </div>

          {/* ── Header ── */}
          <div
            className="relative z-10 flex items-center justify-between px-8 pt-7 pb-5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            {/* Track identity */}
            <div className="flex items-center gap-4">
              {/* Animated logo tile */}
              <div
                className="relative w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(120,240,142,0.15), rgba(52,211,153,0.08))",
                  border: "1px solid rgba(120,240,142,0.20)",
                  boxShadow: "0 0 20px rgba(120,240,142,0.15)",
                }}
              >
                <Radio className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-black text-white/90 tracking-tight">
                  Now Playing
                </p>
                <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">
                  One Melody Stream
                </p>
              </div>
            </div>

            {/* Right badges */}
            <div className="flex items-center gap-2">
              {/* Quality badge */}
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Waves className="w-3 h-3 text-zinc-500" />
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                  320kbps FLAC
                </span>
              </div>

              {/* Live badge */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(120,240,142,0.08)",
                  border: "1px solid rgba(120,240,142,0.20)",
                }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest">
                  Live Sync
                </span>
              </div>
            </div>
          </div>

          {/* ── Main: Lyrics + EQ ── */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-5">
            {/* LEFT: Lyrics */}
            <div
              className="md:col-span-3 relative px-8 py-10 overflow-hidden"
              style={{ minHeight: "260px" }}
            >
              {/* Top fade */}
              <div
                className="absolute top-0 left-0 right-0 h-12 z-20 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(8,10,8,0.98), transparent)",
                }}
              />
              {/* Bottom fade */}
              <div
                className="absolute bottom-0 left-0 right-0 h-12 z-20 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to top, rgba(8,10,8,0.98), transparent)",
                }}
              />

              <div className="relative z-10 flex flex-col justify-center gap-3.5 h-full text-left">
                {offsets.map((offset) => {
                  const idx =
                    (activeIndex + offset + lyrics.length) % lyrics.length;
                  const line = lyrics[idx];
                  const isActive = offset === 0;
                  const dist = Math.abs(offset);

                  return (
                    <AnimatePresence
                      mode="wait"
                      key={`${offset}-${activeIndex}`}
                    >
                      <motion.div
                        key={`${idx}-${offset}`}
                        initial={{ opacity: 0, x: -12, filter: "blur(6px)" }}
                        animate={{
                          opacity: isActive ? 1 : dist === 1 ? 0.25 : 0.08,
                          x: 0,
                          scale: isActive ? 1 : dist === 1 ? 0.97 : 0.93,
                          filter: isActive
                            ? "blur(0px)"
                            : `blur(${dist * 2}px)`,
                        }}
                        exit={{ opacity: 0, x: 12, filter: "blur(6px)" }}
                        transition={{
                          duration: 0.55,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        {isActive ? (
                          <p
                            className="font-black text-2xl md:text-3xl leading-tight"
                            style={{
                              background:
                                "linear-gradient(90deg, #fff 30%, rgba(120,240,142,0.9) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                              textShadow: "none",
                              filter:
                                "drop-shadow(0 0 20px rgba(120,240,142,0.35))",
                            }}
                          >
                            {line}
                          </p>
                        ) : (
                          <p className="font-medium text-lg md:text-xl leading-tight text-zinc-500">
                            {line}
                          </p>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: EQ Visualizer */}
            <div
              className="md:col-span-2 flex flex-col justify-center px-6 py-8"
              style={{ borderLeft: "1px solid rgba(255,255,255,0.04)" }}
            >
              {/* EQ label */}
              <div className="flex items-center gap-2 mb-4">
                <Music2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                  Spectrum Analyzer
                </span>
              </div>

              {/* EQ bars */}
              <div className="h-28 w-full mb-5 relative">
                {/* Green reflection below */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
                  style={{ background: "rgba(120,240,142,0.15)" }}
                />
                <EqBars active />
              </div>

              {/* Frequency labels */}
              <div className="flex justify-between text-[7px] font-mono text-zinc-700 mb-5">
                {["60", "250", "1k", "4k", "16k"].map((f) => (
                  <span key={f}>{f}Hz</span>
                ))}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Bitrate", value: "320kbps" },
                  { label: "Format", value: "FLAC" },
                  { label: "Latency", value: "<80ms" },
                  { label: "Protocol", value: "HLS" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl px-3 py-2"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="text-[7px] text-zinc-600 uppercase tracking-wider font-bold">
                      {label}
                    </p>
                    <p className="text-[11px] font-black text-white/80 mt-0.5">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Footer: Progress ── */}
          <div
            className="relative z-10 px-8 pb-7 pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div className="flex justify-between text-[9px] font-mono text-zinc-600 mb-2">
              <span>{fmt(elapsed)}</span>
              <span className="text-zinc-700">{fmt(totalSecs)}</span>
            </div>

            {/* Track */}
            <div
              className="relative h-1 w-full rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              {/* Buffered indicator */}
              <div
                className="absolute h-full rounded-full"
                style={{
                  width: `${Math.min(progress + 15, 100)}%`,
                  background: "rgba(120,240,142,0.12)",
                }}
              />
              {/* Played */}
              <motion.div
                className="absolute h-full rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, var(--primary) 0%, #34d399 100%)",
                  boxShadow: "0 0 8px rgba(120,240,142,0.5)",
                }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.08, ease: "linear" }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
