"use client";

import React from "react";

interface StaticLyricsViewProps {
  plainLyrics: string;
}

export const StaticLyricsView: React.FC<StaticLyricsViewProps> = ({ plainLyrics }) => {
  return (
    <div className="w-full max-w-2xl lg:max-w-3xl py-4 md:py-8">
      {/* Badge */}
      <div className="flex items-center gap-2 mb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Synced lyrics not available
        </span>
      </div>

      {/* Plain lyrics text */}
      <div className="space-y-2 text-left">
        {plainLyrics.split("\n").map((line, idx) => (
          <p
            key={idx}
            className={`text-base sm:text-lg md:text-xl font-bold tracking-tight leading-relaxed ${
              line.trim() === ""
                ? "h-4"
                : "text-white/70"
            }`}
          >
            {line || "\u00A0"}
          </p>
        ))}
      </div>
    </div>
  );
};
