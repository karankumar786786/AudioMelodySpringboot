"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { Song } from "@/lib/api/types";
import { Particles } from "@/components/ui/particles";

interface ZenBackgroundProps {
  currentSong: Song;
  videoKey?: string;
  canvasVideoUrl?: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  solidBgColor: string;
  isPlaying: boolean;
  coverUrl: string;
}

export const ZenBackground: React.FC<ZenBackgroundProps> = ({
  currentSong,
  videoKey,
  canvasVideoUrl,
  videoRef,
  solidBgColor,
  isPlaying,
  coverUrl,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
      <AnimatePresence mode="wait">
        {canvasVideoUrl ? (
          /* Looping Canvas Video in Low Brightness for Canvas-enabled tracks */
          <motion.div
            key={`zen-canvas-video-${currentSong.id}-${videoKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full"
          >
            <video
              ref={videoRef}
              src={canvasVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover scale-105 filter brightness-[0.45] contrast-[1.08] saturate-[1.25]"
            />
            {/* Color Tint Overlay over video */}
            <div
              style={{
                background: `radial-gradient(ellipse 90% 80% at 50% 35%, ${solidBgColor}40 0%, ${solidBgColor}15 60%, rgba(0,0,0,0.85) 100%)`,
              }}
              className="absolute inset-0 mix-blend-screen"
            />
          </motion.div>
        ) : coverUrl ? (
          /* Blurred Song Image with Majority Background Color Blur */
          <motion.div
            key={`zen-blur-bg-${currentSong.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full"
          >
            <Image
              src={coverUrl}
              alt={currentSong.title}
              fill
              priority
              className="object-cover blur-[85px] scale-125 opacity-35 saturate-150"
            />
            {/* Majority Song Color Ambient Glow Backdrop with Blur */}
            <div
              style={{
                background: `radial-gradient(ellipse 90% 75% at 50% 35%, ${solidBgColor}55 0%, ${solidBgColor}25 50%, rgba(0,0,0,0.92) 85%)`,
              }}
              className="absolute inset-0"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Floating Magic UI Particles for Dreamy Zen Mood */}
      <Particles
        quantity={30}
        color={solidBgColor || "#1ed760"}
        className="absolute inset-0 z-1 opacity-30 pointer-events-none"
      />

      {/* Dynamic Audio Pulsing Aura */}
      <div
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 75% 65% at 50% 40%, ${solidBgColor}45 0%, ${solidBgColor}18 50%, transparent 80%)`,
        }}
        className={`absolute inset-0 transition-all duration-1000 ease-out blur-3xl z-2 ${
          isPlaying ? "scale-105 opacity-100" : "scale-100 opacity-40"
        }`}
      />

      {/* Cinematic Dark Vignette Overlay for Ultra-Crisp Lyric Legibility */}
      <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/35 to-black/80 pointer-events-none z-3" />
    </div>
  );
};
