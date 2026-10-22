"use client";

import { useState } from "react";
import { X, Music, Video, Film, Loader2 } from "lucide-react";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { adminFetch } from "@/lib/adminFetch";
import {
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
  UploadError,
  uploadToImageKitWithProgress,
  uploadToS3WithProgress,
  uploadWithProgress,
} from "@/lib/upload-utils";
import type { CreateSongFormData, UploadMode, UploadProgressStats, UploadErrorState } from "../types";

interface CreateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const initialFormData: CreateSongFormData = {
  title: "",
  artistName: "",
  language: "Hindi",
  genre: "",
  album: "",
  lrclibId: "",
  songFile: null,
  imageFile: null,
  videoFile: null,
  fullVideoFile: null,
  clipStartMin: 0,
  clipStartSec: 0,
  clipEndMin: 0,
  clipEndSec: 15,
  previewStartMin: "",
  previewStartSec: "",
  previewEndMin: "",
  previewEndSec: "",
};

export function CreateSongModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}: CreateSongModalProps) {
  const [formData, setFormData] = useState<CreateSongFormData>(initialFormData);
  const [uploadMode, setUploadMode] = useState<UploadMode>("audio");
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploadStats, setUploadStats] = useState<UploadProgressStats>({});
  const [uploadError, setUploadError] = useState<UploadErrorState | null>(null);
  const [retryStatusText, setRetryStatusText] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isOpen) return null;

  const resetState = () => {
    setFormData(initialFormData);
    setUploadMode("audio");
    setUploading(false);
    setUploadStep(0);
    setUploadProgressText("");
    setUploadPercent(null);
    setUploadStats({});
    setUploadError(null);
    setRetryStatusText("");
    setIsRetrying(false);
  };

  const handleClose = () => {
    if (uploading) {
      if (!confirm("Upload in progress. Are you sure you want to cancel?")) {
        return;
      }
    }
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isDeviceOnline()) {
      const offlineErr = getFriendlyUploadErrorMessage(
        new UploadError("You appear to be offline. Please check your connection.", {
          isOffline: true,
          isNetworkError: true,
          canRetry: true,
        }),
      );
      setUploadError(offlineErr);
      setUploading(true);
      showToast(offlineErr.message, "error");
      return;
    }

    if (uploadMode === "videoOnly") {
      if (!formData.fullVideoFile) return showToast("Please select a full video file", "error");
    } else {
      if (!formData.songFile) return showToast("Please select an audio file", "error");
    }
    if (!formData.imageFile) return showToast("Please select a cover image", "error");
    if (!formData.title.trim()) return showToast("Please enter a song title", "error");
    if (!formData.artistName.trim()) return showToast("Please enter an artist name", "error");

    setUploading(true);
    setUploadError(null);
    setRetryStatusText("");
    setIsRetrying(false);
    setUploadStep(1);
    setUploadPercent(0);
    setUploadStats({});
    setUploadProgressText(
      uploadMode === "videoOnly"
        ? "Uploading full video to S3 storage..."
        : "Uploading audio file to S3 storage...",
    );

    const uploadRetryHandler = (attempt: number, maxRetries: number, delayMs: number) => {
      setIsRetrying(true);
      setRetryStatusText(
        `Network issue detected. Retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt}/${maxRetries})...`,
      );
    };

    try {
      let tempSongKey: string | null = null;
      let tempVideoKey: string | null = null;

      // 1. Audio Upload
      if (formData.songFile) {
        setUploadStep(1);
        setUploadProgressText("Uploading audio file to S3 storage...");
        setUploadPercent(0);
        setUploadStats({ fileName: formData.songFile.name });

        const s3AudioRes = await uploadToS3WithProgress(
          formData.songFile,
          "/webhook/internal/song-upload-url",
          formData.songFile.type || "audio/mpeg",
          (p) => {
            setUploadPercent(p.percent);
            setUploadStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
              fileName: formData.songFile?.name,
            });
          },
          { onRetry: uploadRetryHandler, maxRetries: 4 },
        );
        setIsRetrying(false);
        setRetryStatusText("");
        tempSongKey = s3AudioRes.key;
      }

      // 2. Full Video Upload
      if (formData.fullVideoFile) {
        setUploadStep(1);
        setUploadProgressText("Uploading full music video to S3 storage...");
        setUploadPercent(0);
        setUploadStats({ fileName: formData.fullVideoFile.name });

        const s3VideoRes = await uploadToS3WithProgress(
          formData.fullVideoFile,
          "/webhook/internal/video-upload-url",
          formData.fullVideoFile.type || "video/mp4",
          (p) => {
            setUploadPercent(p.percent);
            setUploadStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
              fileName: formData.fullVideoFile?.name,
            });
          },
          { onRetry: uploadRetryHandler, maxRetries: 4 },
        );
        setIsRetrying(false);
        setRetryStatusText("");
        tempVideoKey = s3VideoRes.key;
      }

      // 3. Cover Image Upload (ImageKit)
      setUploadStep(2);
      setUploadProgressText("Uploading cover artwork to ImageKit CDN...");
      setUploadPercent(0);
      setUploadStats({ fileName: formData.imageFile.name });

      const uploadedImageKey = await uploadToImageKitWithProgress(
        formData.imageFile,
        "/songs/images",
        (p) => {
          setUploadPercent(p.percent);
          setUploadStats({
            loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
            speedText: p.speedText,
            fileName: formData.imageFile?.name,
          });
        },
        { onRetry: uploadRetryHandler },
      );
      setIsRetrying(false);
      setRetryStatusText("");

      // 4. Canvas Video Upload (optional)
      let uploadedVideoKey: string | null = null;
      if (uploadMode === "audio" && formData.videoFile) {
        setUploadStep(2);
        setUploadProgressText("Uploading canvas background loop to ImageKit CDN...");
        setUploadPercent(0);
        setUploadStats({ fileName: formData.videoFile.name });

        uploadedVideoKey = await uploadToImageKitWithProgress(
          formData.videoFile,
          "/songs/videos",
          (p) => {
            setUploadPercent(p.percent);
            setUploadStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
              fileName: formData.videoFile?.name,
            });
          },
          { onRetry: uploadRetryHandler },
        );
        setIsRetrying(false);
        setRetryStatusText("");
      }

      let previewStartTime: number | null = null;
      if (formData.previewStartMin !== "" || formData.previewStartSec !== "") {
        const min = parseInt(String(formData.previewStartMin), 10) || 0;
        const sec = parseInt(String(formData.previewStartSec), 10) || 0;
        previewStartTime = min * 60 + sec;
      }

      let previewEndTime: number | null = null;
      if (formData.previewEndMin !== "" || formData.previewEndSec !== "") {
        const min = parseInt(String(formData.previewEndMin), 10) || 0;
        const sec = parseInt(String(formData.previewEndSec), 10) || 0;
        previewEndTime = min * 60 + sec;
      }

      // 5. Finalize Song Creation in Django backend
      setUploadStep(3);
      setUploadPercent(100);
      setUploadProgressText("Registering song & scheduling background processing...");
      setUploadStats({});

      const finalizeRes = await adminFetch("/admin/song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          artistName: formData.artistName,
          tempSongKey: tempSongKey || undefined,
          tempVideoKey: tempVideoKey || undefined,
          imageKey: uploadedImageKey,
          videoKey: uploadedVideoKey,
          clipStartMin: uploadMode === "videoOnly" ? Number(formData.clipStartMin) : undefined,
          clipStartSec: uploadMode === "videoOnly" ? Number(formData.clipStartSec) : undefined,
          clipEndMin: uploadMode === "videoOnly" ? Number(formData.clipEndMin) : undefined,
          clipEndSec: uploadMode === "videoOnly" ? Number(formData.clipEndSec) : undefined,
          previewStartTime,
          previewEndTime,
          language: formData.language,
          genre: formData.genre || undefined,
          album: formData.album || undefined,
          lrclibId: formData.lrclibId || undefined,
        }),
      });

      if (!finalizeRes.ok) {
        const errData = await finalizeRes.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to create track record in system");
      }

      showToast("Track created successfully and queued for processing!", "success");
      resetState();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Song creation failed:", err);
      const friendlyErr = getFriendlyUploadErrorMessage(err);
      setUploadError(friendlyErr);
      showToast(friendlyErr.message, "error");
    } finally {
      setUploading(false);
      setIsRetrying(false);
      setRetryStatusText("");
    }
  };

  const inputCls =
    "w-full bg-[#181818] border border-[#282828] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors";
  const labelCls = "block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5";
  const fileCls =
    "w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-[#121212] w-full max-w-4xl rounded-3xl shadow-2xl border border-[#282828] overflow-hidden flex flex-col max-h-[90vh] text-white">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#282828] flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Add New Track</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upload a standard audio track or extract from a full music video
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-zinc-400 hover:text-white hover:rotate-90 transition-all p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-6 py-2.5 bg-black/60 border-b border-[#282828] flex gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => setUploadMode("audio")}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              uploadMode === "audio"
                ? "bg-white text-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Audio Track</span>
            <span className={`text-[10px] font-normal ${uploadMode === "audio" ? "text-zinc-600" : "text-zinc-500"}`}>
              (Standard)
            </span>
          </button>

          <button
            type="button"
            disabled={uploading}
            onClick={() => setUploadMode("videoOnly")}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              uploadMode === "videoOnly"
                ? "bg-white text-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Video Only</span>
            <span className={`text-[10px] font-normal ${uploadMode === "videoOnly" ? "text-zinc-600" : "text-zinc-500"}`}>
              (Auto-Audio & Canvas)
            </span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Progress / Error Alerts */}
          {uploading && (
            <UploadProgressBar
              percent={uploadPercent ?? 0}
              statusText={uploadProgressText}
              step={uploadStep}
              totalSteps={3}
              fileName={uploadStats.fileName}
              loadedText={uploadStats.loadedText}
              speedText={uploadStats.speedText}
              error={uploadError}
              retryStatusText={retryStatusText}
              isRetrying={isRetrying}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Metadata Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="song-title" className={labelCls}>
                  Track Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="song-title"
                  required
                  type="text"
                  placeholder="e.g. Starboy"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="song-artist" className={labelCls}>
                  Artist Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="song-artist"
                  required
                  type="text"
                  placeholder="e.g. The Weeknd"
                  value={formData.artistName}
                  onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="song-language" className={labelCls}>Language</label>
                  <input
                    id="song-language"
                    type="text"
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="song-genre" className={labelCls}>Genre</label>
                  <input
                    id="song-genre"
                    type="text"
                    placeholder="e.g. Pop"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="song-album" className={labelCls}>Album</label>
                  <input
                    id="song-album"
                    type="text"
                    placeholder="Optional album"
                    value={formData.album}
                    onChange={(e) => setFormData({ ...formData, album: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="song-lrclib" className={labelCls}>LRCLIB ID</label>
                  <input
                    id="song-lrclib"
                    type="text"
                    placeholder="Lyrics sync ID"
                    value={formData.lrclibId}
                    onChange={(e) => setFormData({ ...formData, lrclibId: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Preview Snippet Timing */}
              <div className="bg-[#181818] border border-[#282828] rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                  Audio Snack / Preview Snippet
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block mb-1">Start (min:sec)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.previewStartMin}
                        onChange={(e) => setFormData({ ...formData, previewStartMin: e.target.value })}
                        className="w-16 bg-black/50 border border-[#282828] rounded-lg p-1.5 text-center font-mono text-white"
                      />
                      <span className="text-zinc-600">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="00"
                        value={formData.previewStartSec}
                        onChange={(e) => setFormData({ ...formData, previewStartSec: e.target.value })}
                        className="w-16 bg-black/50 border border-[#282828] rounded-lg p-1.5 text-center font-mono text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-1">End (min:sec)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.previewEndMin}
                        onChange={(e) => setFormData({ ...formData, previewEndMin: e.target.value })}
                        className="w-16 bg-black/50 border border-[#282828] rounded-lg p-1.5 text-center font-mono text-white"
                      />
                      <span className="text-zinc-600">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="30"
                        value={formData.previewEndSec}
                        onChange={(e) => setFormData({ ...formData, previewEndSec: e.target.value })}
                        className="w-16 bg-black/50 border border-[#282828] rounded-lg p-1.5 text-center font-mono text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Media Uploads */}
            <div className="space-y-4">
              {/* Cover Artwork */}
              <div className="bg-[#181818] border border-[#282828] rounded-2xl p-4">
                <label className={labelCls}>
                  Cover Image Artwork <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, imageFile: e.target.files?.[0] || null })}
                  className={fileCls}
                />
              </div>

              {/* Audio Track File */}
              {uploadMode === "audio" && (
                <div className="bg-[#181818] border border-[#282828] rounded-2xl p-4">
                  <label className={labelCls}>
                    Audio File (.mp3, .wav, .flac) <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setFormData({ ...formData, songFile: e.target.files?.[0] || null })}
                    className={fileCls}
                  />
                </div>
              )}

              {/* Full Video File */}
              {uploadMode === "videoOnly" && (
                <div className="bg-[#181818] border border-[#282828] rounded-2xl p-4">
                  <label className={labelCls}>
                    Full Video File (.mp4, .mov, .mkv) <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="file"
                    accept="video/*"
                    onChange={(e) => setFormData({ ...formData, fullVideoFile: e.target.files?.[0] || null })}
                    className={fileCls}
                  />
                </div>
              )}

              {/* Canvas Loop Video */}
              {uploadMode === "audio" && (
                <div className="bg-[#181818] border border-[#282828] rounded-2xl p-4">
                  <label className={labelCls}>
                    Canvas Video Loop <span className="text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setFormData({ ...formData, videoFile: e.target.files?.[0] || null })}
                    className={fileCls}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-[#282828] flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl border border-[#282828] text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{uploading ? "Uploading & Processing..." : "Create & Queue Track"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
