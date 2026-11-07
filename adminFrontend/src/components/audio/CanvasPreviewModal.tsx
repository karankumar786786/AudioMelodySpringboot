"use client";

import React from "react";
import { X, Film, Volume2 } from "lucide-react";
import { useAudio } from "@/lib/audio-context";
import { getImageUrl } from "@/lib/image-utils";

export function CanvasPreviewModal() {
  const { currentTrack, isCanvasOpen, setIsCanvasOpen, isPlaying } = useAudio();

  if (!isCanvasOpen || !currentTrack) return null;

  const videoUrl = currentTrack.videoKey
    ? getImageUrl(currentTrack.videoKey)
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative flex flex-col items-center max-w-sm w-full bg-[#121215] border border-white/[0.12] rounded-3xl overflow-hidden shadow-2xl">
        {/* Header bar */}
        <div className="w-full px-5 py-4 flex items-center justify-between border-b border-white/[0.08] bg-[#0d0d0f]">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Film className="w-4 h-4 text-indigo-400" />
            <span>Vertical Video Canvas (9:16)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsCanvasOpen(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Canvas Container (9:16 aspect ratio) */}
        <div className="relative w-full aspect-[9/16] bg-black flex items-center justify-center overflow-hidden">
          {videoUrl ? (
            <video
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center text-zinc-500 gap-2 p-6 text-center">
              <Film className="w-10 h-10 stroke-1" />
              <p className="text-xs">No video canvas attached to this song.</p>
            </div>
          )}

          {/* Bottom Track Meta Overlay */}
          <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between">
            <div className="min-w-0 pr-3">
              <h4 className="text-white font-bold text-sm truncate">
                {currentTrack.title}
              </h4>
              <p className="text-zinc-300 text-xs truncate">
                {currentTrack.artistName || "Unknown Artist"}
              </p>
            </div>
            {isPlaying && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                <Volume2 className="w-3 h-3 animate-pulse" />
                <span>Audio Synced</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
