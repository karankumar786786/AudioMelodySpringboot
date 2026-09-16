"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  X,
  AlertTriangle,
  Music,
  Film,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { JobProgress } from "@/lib/api";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import {
  uploadWithProgress,
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
} from "@/lib/upload-utils";

interface RecoverJobMediaModalProps {
  job: JobProgress | null;
  onClose: () => void;
  onSuccess: (updated: JobProgress) => void;
}

interface RecoverErrorState {
  title?: string;
  message: string;
  isNetworkError?: boolean;
  canRetry?: boolean;
}

export const RecoverJobMediaModal: React.FC<RecoverJobMediaModalProps> = ({
  job,
  onClose,
  onSuccess,
}) => {
  const [recoverAudioFile, setRecoverAudioFile] = useState<File | null>(null);
  const [recoverVideoFile, setRecoverVideoFile] = useState<File | null>(null);
  const [recoverClipStartMin, setRecoverClipStartMin] = useState<string | number>("");
  const [recoverClipStartSec, setRecoverClipStartSec] = useState<string | number>("");
  const [recoverClipEndMin, setRecoverClipEndMin] = useState<string | number>("");
  const [recoverClipEndSec, setRecoverClipEndSec] = useState<string | number>("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverPercent, setRecoverPercent] = useState<number | null>(null);
  const [recoverProgressText, setRecoverProgressText] = useState("");
  const [recoverStats, setRecoverStats] = useState<{
    loadedText?: string;
    speedText?: string;
    fileName?: string;
  }>({});
  const [recoverError, setRecoverError] = useState<RecoverErrorState | null>(null);
  const [isRecoverRetrying, setIsRecoverRetrying] = useState(false);
  const [recoverRetryStatusText, setRecoverRetryStatusText] = useState("");

  if (!job) return null;

  const handleClose = () => {
    if (isRecovering) return;
    setRecoverAudioFile(null);
    setRecoverVideoFile(null);
    setRecoverError(null);
    onClose();
  };

  const handleRecoverJobSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!job) return;

    if (!recoverAudioFile && !recoverVideoFile) {
      setRecoverError({
        title: "No Media Selected",
        message: "Please select at least one replacement audio or video file to reprocess.",
      });
      return;
    }

    if (!isDeviceOnline()) {
      setRecoverError({
        title: "You Are Offline",
        message: "Network is currently disconnected. Reconnect to upload replacement media.",
        isNetworkError: true,
      });
      return;
    }

    setIsRecovering(true);
    setRecoverError(null);

    const retryHandler = (attempt: number, maxRetries: number, delayMs: number) => {
      setIsRecoverRetrying(true);
      setRecoverRetryStatusText(
        `Network issue detected. Retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt}/${maxRetries})...`
      );
    };

    try {
      let tempSongKey: string | null = null;
      let tempVideoKey: string | null = null;

      // 1. Upload replacement audio if selected
      if (recoverAudioFile) {
        setRecoverProgressText("Uploading replacement audio to S3...");
        setRecoverPercent(0);
        setRecoverStats({ fileName: recoverAudioFile.name });

        const urlRes = await adminFetch("/webhook/internal/song-upload-url");
        if (!urlRes.ok) throw new Error("Failed to authorize audio upload");
        const urlData = await urlRes.json();

        await uploadWithProgress(
          urlData.preSignedUrl,
          recoverAudioFile,
          "PUT",
          { "Content-Type": recoverAudioFile.type || "audio/mpeg" },
          (p) => {
            setRecoverPercent(p.percent);
            setRecoverStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
              fileName: recoverAudioFile.name,
            });
          },
          { onRetry: retryHandler }
        );
        setIsRecoverRetrying(false);
        setRecoverRetryStatusText("");
        tempSongKey = urlData.key;
      }

      // 2. Upload replacement video if selected
      if (recoverVideoFile) {
        setRecoverProgressText("Uploading replacement video to S3...");
        setRecoverPercent(0);
        setRecoverStats({ fileName: recoverVideoFile.name });

        const urlRes = await adminFetch("/webhook/internal/video-upload-url");
        if (!urlRes.ok) throw new Error("Failed to authorize video upload");
        const urlData = await urlRes.json();

        await uploadWithProgress(
          urlData.preSignedUrl,
          recoverVideoFile,
          "PUT",
          { "Content-Type": recoverVideoFile.type || "video/mp4" },
          (p) => {
            setRecoverPercent(p.percent);
            setRecoverStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
              fileName: recoverVideoFile.name,
            });
          },
          { onRetry: retryHandler }
        );
        setIsRecoverRetrying(false);
        setRecoverRetryStatusText("");
        tempVideoKey = urlData.key;
      }

      // 3. Parse optional canvas clip timestamps
      let clipStartMin: number | undefined = undefined;
      let clipStartSec: number | undefined = undefined;
      let clipEndMin: number | undefined = undefined;
      let clipEndSec: number | undefined = undefined;

      if (recoverClipStartMin !== "") clipStartMin = parseInt(String(recoverClipStartMin), 10) || 0;
      if (recoverClipStartSec !== "") clipStartSec = parseInt(String(recoverClipStartSec), 10) || 0;
      if (recoverClipEndMin !== "") clipEndMin = parseInt(String(recoverClipEndMin), 10) || 0;
      if (recoverClipEndSec !== "") clipEndSec = parseInt(String(recoverClipEndSec), 10) || 0;

      // 4. Trigger recovery endpoint on coreEngine
      setRecoverProgressText("Re-enqueueing job with healthy media...");
      setRecoverPercent(100);

      const res = await adminFetch(`/admin/jobs/${job.id}/recover-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempSongKey,
          tempVideoKey,
          clipStartMin,
          clipStartSec,
          clipEndMin,
          clipEndSec,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Failed to recover failed ingestion job.");
      }

      const updated: JobProgress = await res.json();
      onSuccess(updated);
      handleClose();
    } catch (err: any) {
      console.error("Failed to recover job:", err);
      const friendly = getFriendlyUploadErrorMessage(err);
      setRecoverError(friendly);
    } finally {
      setIsRecovering(false);
      setIsRecoverRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#282828] rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-[#282828] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Upload & Reprocess Job</h3>
              <p className="text-xs text-zinc-400">
                Replace corrupted audio or video for{" "}
                <span className="text-white font-medium">{job.title}</span> ({job.artistName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isRecovering}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body / Form */}
        <form onSubmit={handleRecoverJobSubmit} className="p-6 space-y-4 relative">
          {/* Recovery Upload Overlay with animated real-time progress bar & error/retry controls */}
          {(isRecovering || recoverError) && (
            <div className="absolute inset-0 z-30 bg-black/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
              <UploadProgressBar
                percent={recoverPercent ?? 0}
                statusText={recoverProgressText || "Transferring replacement media..."}
                fileName={recoverStats.fileName}
                loadedText={recoverStats.loadedText}
                speedText={recoverStats.speedText}
                step={
                  recoverAudioFile && recoverVideoFile
                    ? recoverProgressText.toLowerCase().includes("video")
                      ? 2
                      : 1
                    : 1
                }
                totalSteps={recoverAudioFile && recoverVideoFile ? 2 : 1}
                stepLabels={
                  recoverAudioFile && recoverVideoFile
                    ? ["Audio Track", "Video Stream"]
                    : ["S3 Storage"]
                }
                error={recoverError}
                onRetry={() => handleRecoverJobSubmit()}
                onCancel={() => {
                  setRecoverError(null);
                  setIsRecovering(false);
                  setIsRecoverRetrying(false);
                  setRecoverRetryStatusText("");
                }}
                retryStatusText={recoverRetryStatusText}
                isRetrying={isRecoverRetrying}
              />
            </div>
          )}

          {/* Failure Notice Reminder */}
          {job.failureReason && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-bold block">Previous Failure Reason:</span>
                <span className="text-zinc-300 line-clamp-2">{job.failureReason}</span>
              </div>
            </div>
          )}

          {/* Error display */}
          {recoverError && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold block">{recoverError.title || "Recovery Error"}</span>
                <span>{recoverError.message}</span>
              </div>
            </div>
          )}

          {/* Replacement Audio */}
          <div className="border border-dashed border-[#282828] rounded-2xl p-4 bg-black/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Music className="w-4 h-4 text-emerald-400" />
                Replacement Audio Track
              </label>
              {recoverAudioFile && (
                <button
                  type="button"
                  onClick={() => setRecoverAudioFile(null)}
                  className="text-[11px] font-bold text-zinc-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">
              Upload an uncorrupted audio file (.mp3, .wav, .flac, .aac, .m4a) to replace the damaged audio stream.
            </p>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.flac,.aac,.m4a"
              disabled={isRecovering}
              onChange={(e) => setRecoverAudioFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#282828] file:text-white hover:file:bg-zinc-700 cursor-pointer"
            />
            {recoverAudioFile && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  Selected: {recoverAudioFile.name} ({(recoverAudioFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>
            )}
          </div>

          {/* Replacement Video */}
          <div className="border border-dashed border-[#282828] rounded-2xl p-4 bg-black/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Film className="w-4 h-4 text-blue-400" />
                Replacement Video File (optional)
              </label>
              {recoverVideoFile && (
                <button
                  type="button"
                  onClick={() => setRecoverVideoFile(null)}
                  className="text-[11px] font-bold text-zinc-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">
              Upload a replacement video (.mp4, .mov) if the source video was corrupt or missing.
            </p>
            <input
              type="file"
              accept="video/*,.mp4,.mov"
              disabled={isRecovering}
              onChange={(e) => setRecoverVideoFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#282828] file:text-white hover:file:bg-zinc-700 cursor-pointer"
            />
            {recoverVideoFile && (
              <div className="text-[11px] text-blue-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  Selected: {recoverVideoFile.name} ({(recoverVideoFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>
            )}
          </div>

          {/* Canvas Timestamps (Optional) */}
          {recoverVideoFile && (
            <div className="p-3 bg-black/50 border border-[#282828] rounded-2xl space-y-2">
              <span className="text-[11px] font-bold text-zinc-300 block">
                Optional Canvas Loop Timestamps
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-1">Start (min : sec)</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={recoverClipStartMin}
                      onChange={(e) => setRecoverClipStartMin(e.target.value)}
                      className="w-14 bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                    />
                    <span className="text-zinc-500 font-bold">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={recoverClipStartSec}
                      onChange={(e) => setRecoverClipStartSec(e.target.value)}
                      className="w-14 bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-1">End (min : sec)</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={recoverClipEndMin}
                      onChange={(e) => setRecoverClipEndMin(e.target.value)}
                      className="w-14 bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                    />
                    <span className="text-zinc-500 font-bold">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={recoverClipEndSec}
                      onChange={(e) => setRecoverClipEndSec(e.target.value)}
                      className="w-14 bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isRecovering}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-full transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRecovering || (!recoverAudioFile && !recoverVideoFile)}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-full transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isRecovering ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  Uploading & Recovering...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload & Reprocess Job
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
