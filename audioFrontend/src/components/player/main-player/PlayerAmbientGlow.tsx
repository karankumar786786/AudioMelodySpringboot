"use client";

import React from "react";

interface PlayerAmbientGlowProps {
  solidBgColor: string;
  isPlaying: boolean;
}

export const PlayerAmbientGlow: React.FC<PlayerAmbientGlowProps> = ({
  solidBgColor,
  isPlaying,
}) => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      <div
        style={{
          background: `radial-gradient(ellipse 65% 50% at 50% 10%, ${solidBgColor}28 0%, ${solidBgColor}0a 45%, transparent 80%)`,
        }}
        className={`absolute top-0 left-0 right-0 h-[450px] transition-all duration-1000 ease-out blur-3xl ${
          isPlaying ? "opacity-100 scale-105" : "opacity-35 scale-100"
        }`}
      />
      <div
        style={{
          background: `radial-gradient(ellipse 85% 140px at 50% 100%, ${solidBgColor}66 0%, ${solidBgColor}22 55%, transparent 85%)`,
        }}
        className={`absolute bottom-20 left-0 right-0 h-36 transition-all duration-700 ease-out blur-2xl ${
          isPlaying ? "opacity-90 scale-100" : "opacity-35 scale-95"
        }`}
      />
    </div>
  );
};
