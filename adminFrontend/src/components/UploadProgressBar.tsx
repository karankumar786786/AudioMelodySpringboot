"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  Image as ImageIcon,
  Loader2,
  Music,
  RotateCw,
  Video,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

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
  // Error & Recovery Props
  error?: {
    title?: string;
    message: string;
    isNetworkError?: boolean;
    canRetry?: boolean;
  } | null;
  onRetry?: () => void;
  onCancel?: () => void;
  retryStatusText?: string;
  isRetrying?: boolean;
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
  error,
  onRetry,
  onCancel,
  retryStatusText,
  isRetrying = false,
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

  // ==========================================
  // INLINE VARIANT
  // ==========================================
  if (variant === "inline") {
    if (error) {
      return (
        <div className="w-full bg-[#181818] border border-rose-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              {error.isNetworkError ? (
                <WifiOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-xs font-bold text-rose-200 leading-tight">
                  {error.title ||
                    (error.isNetworkError
                      ? "Network Connection Error"
                      : "Upload Failed")}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  {error.message}
                </p>
                {retryStatusText && (
                  <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1.5 font-medium">
                    <RotateCw className="w-3 h-3 animate-spin shrink-0" />
                    {retryStatusText}
                  </p>
                )}
              </div>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {(onRetry || onCancel) && (
            <div className="flex items-center gap-2 pt-1">
              {onRetry && error.canRetry !== false && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 active:scale-95 text-black rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCw
                    className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`}
                  />
                  {isRetrying ? "Retrying..." : "Retry"}
                </button>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3 py-1.5 bg-black/60 hover:bg-[#282828] text-zinc-400 hover:text-white border border-[#282828] rounded-lg text-xs font-medium transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="w-full bg-[#181818] border border-[#282828] rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
            <span className="font-semibold text-white truncate">
              {statusText}
            </span>
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

        {retryStatusText && (
          <div className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium pt-1">
            <RotateCw className="w-3 h-3 animate-spin shrink-0" />
            <span>{retryStatusText}</span>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // OVERLAY VARIANT (MODAL DIALOG / FULL COVERAGE)
  // ==========================================
  if (error) {
    return (
      <div className="w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Error Icon with Halo */}
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-950/50">
              {error.isNetworkError ? (
                <WifiOff className="w-6 h-6 text-rose-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
          {error.title ||
            (error.isNetworkError
              ? "Network Connection Error"
              : "Upload Interrupted")}
        </h3>

        {/* Error Description Box */}
        <div className="w-full bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 text-left mb-6 shadow-inner">
          <p className="text-xs text-rose-200 leading-relaxed">
            {error.message}
          </p>
          <div className="mt-2.5 pt-2.5 border-t border-rose-500/20 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Form entries & selected files remain intact.</span>
            {fileName && (
              <span className="font-mono text-zinc-300 truncate max-w-[180px] ml-2">
                {fileName}
              </span>
            )}
          </div>
        </div>

        {/* Live Auto-Retry Countdown or notice */}
        {retryStatusText && (
          <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl px-4 py-2.5 text-xs font-medium flex items-center justify-center gap-2 mb-6 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{retryStatusText}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 w-full mb-6">
          {onRetry && error.canRetry !== false && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="flex-1 max-w-[200px] py-3.5 px-5 bg-white hover:bg-zinc-200 active:scale-95 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10 disabled:opacity-50"
            >
              <RotateCw
                className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`}
              />
              {isRetrying ? "Retrying..." : "Retry Upload"}
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 max-w-[180px] py-3.5 px-4 bg-black/60 hover:bg-[#202020] text-zinc-300 hover:text-white border border-[#282828] font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Edit Details
            </button>
          )}
        </div>

        {/* Step Indicators with Failure Marker */}
        {step !== undefined && totalSteps > 1 && (
          <div className="grid grid-cols-3 gap-2.5 w-full">
            {stepLabels.map((label, idx) => {
              const stepNum = idx + 1;
              const isDone = step > stepNum;
              const isFailed = step === stepNum;

              return (
                <div
                  key={label}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isFailed
                      ? "bg-rose-950/30 border-rose-500/50 text-rose-200 shadow-md shadow-rose-950/30"
                      : isDone
                        ? "bg-[#181818] border-zinc-700 text-white"
                        : "bg-black/60 border-[#282828] text-zinc-500"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        isFailed
                          ? "bg-rose-500 text-white font-bold"
                          : isDone
                            ? "bg-white text-black"
                            : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {isFailed ? "!" : isDone ? "✓" : stepNum}
                    </span>
                    <span className="truncate">{label}</span>
                  </div>
                  <span className="text-[10px] opacity-75 truncate block">
                    {isFailed
                      ? "Failed here"
                      : isDone
                        ? "Completed"
                        : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Normal Overlay State (Uploading)
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

        {retryStatusText && (
          <div className="text-[11px] text-amber-400 flex items-center justify-center gap-1.5 font-medium pt-2">
            <RotateCw className="w-3 h-3 animate-spin shrink-0" />
            <span>{retryStatusText}</span>
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

      {onCancel && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors"
          >
            Cancel upload
          </button>
        </div>
      )}
    </div>
  );
}
