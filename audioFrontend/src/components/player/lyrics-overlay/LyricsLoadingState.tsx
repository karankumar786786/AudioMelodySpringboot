"use client";

import React from "react";

export const LyricsLoadingState: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 py-20 my-auto">
      <div className="relative flex items-center justify-center w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping opacity-25" />
        <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-primary border-r-primary animate-spin" />
        <div className="absolute flex items-end justify-center gap-1">
          <span className="w-1 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1 h-5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1 h-2 bg-primary rounded-full animate-bounce" />
        </div>
      </div>
      <p className="text-sm font-semibold text-white/70 tracking-wide animate-pulse">
        Loading lyrics...
      </p>
    </div>
  );
};
