"use client";

import React from "react";
import { Loader2, CheckCircle2, CloudUpload, Music, Video, Image as ImageIcon, Zap } from "lucide-react";

export interface UploadProgressBarProps {
  percent: number;
  statusText?: string;
  fileName?: string;
  loadedText?: string;
  speedText?: string;
  step?: number;
  totalSteps?: number;
  stepLabels?: string[];
  variant?: "overlay" | "inline";
}

export function UploadProgressBar({
  percent,
  statusText = "Uploading files...",
  fileName,
  loadedText,
  speedText,
  step,
  totalSteps = 3,
  stepLabels = ["S3 Storage", "ImageKit CDN", "Worker Ingestion"],
  variant = "overlay",
}: UploadProgressBarProps) {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)));

  const getFileIcon = () => {
    if (!fileName) return <CloudUpload className="w-5 h-5 text-white" />;
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && ["mp3", "wav", "flac", "m4a", "aac"].includes(ext)) {
      return <Music className="w-5 h-5 text-white" />;
    }
    if (ext && ["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) {
      return <Video className="w-5 h-5 text-white" />;
    }
    return <ImageIcon className="w-5 h-5 text-white" />;
  };

  if (variant === "inline") {
    return (
      <div className="w-full bg-[#181818] border border-[#282828] rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
            <span className="font-semibold text-white truncate">{statusText}</span>
          </div>
          <span className="font-mono font-bold text-white text-xs ml-2 shrink-0">
            {safePercent}%
          </span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-[#282828]">
          <div
            className="h-full bg-white rounded-full transition-all duration-200 ease-out shadow-[0_0_8px_rgba(255,255,255,0.4)]"
            style={{ width: `${safePercent}%` }}
          />
        </div>

        {/* Metrics info */}
        {(loadedText || speedText || fileName) && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-0.5">
            <span className="truncate max-w-[200px] text-zinc-300">
              {fileName || loadedText}
            </span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {loadedText && fileName && <span>{loadedText}</span>}
              {speedText && (
                <span className="flex items-center gap-1 text-zinc-300">
                  <Zap className="w-3 h-3 text-white" />
                  {speedText}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Overlay variant (full featured for major upload flows)
  return (
    <div className="w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
      {/* Animated Icon with Pulsing Halo */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full border-4 border-[#282828] border-t-white animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#121212] border border-[#282828] flex items-center justify-center shadow-lg">
            {safePercent >= 100 ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : (
              getFileIcon()
            )}
          </div>
        </div>
      </div>

      {/* Main Title & Status */}
      <h3 className="text-xl font-bold text-white mb-1.5 tracking-tight">
        {statusText}
      </h3>

      {fileName && (
        <p className="text-xs text-zinc-400 font-medium mb-4 truncate max-w-sm">
          File: <span className="text-zinc-200 font-mono">{fileName}</span>
        </p>
      )}

      {/* Modern Progress Bar */}
      <div className="w-full space-y-2 mb-6">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Transfer Progress
          </span>
          <span className="font-mono font-black text-sm text-white">
            {safePercent}%
          </span>
        </div>

        <div className="w-full h-3 bg-black/80 rounded-full overflow-hidden p-0.5 border border-[#282828] shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-zinc-200 to-white rounded-full transition-all duration-200 ease-out shadow-[0_0_12px_rgba(255,255,255,0.45)]"
            style={{ width: `${safePercent}%` }}
          />
        </div>

        {/* Transfer Metrics */}
        {(loadedText || speedText) && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
            <span>{loadedText || "Processing payload..."}</span>
            {speedText && (
              <span className="flex items-center gap-1 text-zinc-300 font-semibold">
                <Zap className="w-3 h-3 text-white" />
                {speedText}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Step Indicators */}
      {step !== undefined && totalSteps > 1 && (
        <div className="grid grid-cols-3 gap-2.5 w-full mb-2">
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            const isDone = step > stepNum;
            const isCurrent = step === stepNum;

            return (
              <div
                key={label}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  isCurrent
                    ? "bg-white text-black border-white shadow-lg shadow-white/5"
                    : isDone
                    ? "bg-[#181818] border-zinc-700 text-white"
                    : "bg-black/60 border-[#282828] text-zinc-500"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      isCurrent
                        ? "bg-black text-white"
                        : isDone
                        ? "bg-white text-black"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {isDone ? "✓" : stepNum}
                  </span>
                  <span className="truncate">{label}</span>
                </div>
                <span className="text-[10px] opacity-75 truncate block">
                  {idx === 0
                    ? "S3 Storage"
                    : idx === 1
                    ? "Artwork & Canvas"
                    : "Background Job"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
