"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RotateCw,
  Music,
  WifiOff,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { adminFetch } from "@/lib/adminFetch";
import { getImageUrl } from "@/lib/image-utils";
import {
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
  UploadError,
  uploadToImageKitWithProgress,
  uploadWithProgress,
} from "@/lib/upload-utils";
import { UploadProgressBar } from "./UploadProgressBar";

export interface SongData {
  id: string;
  title: string;
  artistName: string;
  duration?: number;
  language?: string;
  imageKey?: string;
  videoKey?: string | null;
  fullVideoKey?: string | null;
  previewStartTime?: number | null;
  previewEndTime?: number | null;
  isFeatured?: boolean;
  lrclibId?: string;
  createdAt?: string;
}

interface EditSongModalProps {
  song: SongData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedSong: SongData) => void;
}

export function EditSongModal({
  song,
  isOpen,
  onClose,
  onSuccess,
}: EditSongModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    artistName: "",
    language: "Hindi",
    lrclibId: "",
    previewStartMin: "" as string | number,
    previewStartSec: "" as string | number,
    previewEndMin: "" as string | number,
    previewEndSec: "" as string | number,
    imageFile: null as File | null,
    audioFile: null as File | null,
    videoFile: null as File | null,
    fullVideoFile: null as File | null,
    removeVideo: false,
    removeFullVideo: false,
  });

  const [saving, setSaving] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploadStats, setUploadStats] = useState<{
    loadedText?: string;
    speedText?: string;
    fileName?: string;
  }>({});
  const [error, setError] = useState<{
    title?: string;
    message: string;
    isNetworkError?: boolean;
    canRetry?: boolean;
  } | null>(null);
  const [retryStatusText, setRetryStatusText] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!song) return;

    const startTotal =
      song.previewStartTime !== undefined &&
      song.previewStartTime !== null &&
      song.previewStartTime >= 0
        ? song.previewStartTime
        : null;
    const endTotal =
      song.previewEndTime !== undefined &&
      song.previewEndTime !== null &&
      song.previewEndTime >= 0
        ? song.previewEndTime
        : null;

    setFormData({
      title: song.title || "",
      artistName: song.artistName || "",
      language: song.language || "Hindi",
      lrclibId: song.lrclibId ? String(song.lrclibId) : "",
      previewStartMin: startTotal !== null ? Math.floor(startTotal / 60) : "",
      previewStartSec: startTotal !== null ? startTotal % 60 : "",
      previewEndMin: endTotal !== null ? Math.floor(endTotal / 60) : "",
      previewEndSec: endTotal !== null ? endTotal % 60 : "",
      imageFile: null,
      audioFile: null,
      videoFile: null,
      fullVideoFile: null,
      removeVideo: false,
      removeFullVideo: false,
    });
    setError(null);
  }, [song]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen || !song || !mounted) return null;


  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!song) return;

    if (!isDeviceOnline()) {
      const offlineErr = getFriendlyUploadErrorMessage(
        new UploadError("You appear to be offline.", {
          isOffline: true,
          isNetworkError: true,
        }),
      );
      setError(offlineErr);
      return;
    }

    setSaving(true);
    setError(null);
    setRetryStatusText("");
    setIsRetrying(false);
    setUploadPercent(null);
    setUploadStats({});
    setProgressText("Saving changes...");

    const retryHandler = (
      attempt: number,
      maxRetries: number,
      delayMs: number,
    ) => {
      setIsRetrying(true);
      setRetryStatusText(
        `Network issue detected. Retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt}/${maxRetries})...`,
      );
    };

    try {
      let imageKey = song.imageKey;
      if (formData.imageFile) {
        setProgressText("Uploading new cover image...");
        setUploadPercent(0);
        setUploadStats({ fileName: formData.imageFile.name });
        imageKey = await uploadToImageKitWithProgress(
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
          { onRetry: retryHandler },
        );
        setIsRetrying(false);
        setRetryStatusText("");
      }

      let videoKey: string | null | undefined = song.videoKey;
      if (formData.removeVideo) {
        videoKey = "";
      } else if (formData.videoFile) {
        setProgressText("Uploading canvas video...");
        setUploadPercent(0);
        setUploadStats({ fileName: formData.videoFile.name });
        videoKey = await uploadToImageKitWithProgress(
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
          { onRetry: retryHandler },
        );
        setIsRetrying(false);
        setRetryStatusText("");
      }

      let tempSongKey: string | null = null;
      if (formData.audioFile) {
        setProgressText("Uploading replacement audio to S3...");
        setUploadPercent(0);
        setUploadStats({ fileName: formData.audioFile.name });
        const songUrlRes = await adminFetch("/webhook/internal/song-upload-url");
        if (!songUrlRes.ok) throw new Error("Failed to get audio upload authorization");
        const songUrlData = await songUrlRes.json();

        await uploadWithProgress(
          songUrlData.preSignedUrl,
          formData.audioFile,
          "PUT",
          { "Content-Type": formData.audioFile.type || "audio/mpeg" },
          (p) => {
            setUploadPercent(p.percent);
            setUploadStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
              fileName: formData.audioFile?.name,
            });
          },
          { onRetry: retryHandler },
        );
        setIsRetrying(false);
        setRetryStatusText("");
        tempSongKey = songUrlData.key;
      }

      let fullVideoKey: string | null | undefined = song.fullVideoKey;
      let tempVideoKey: string | null = null;
      if (formData.removeFullVideo) {
        fullVideoKey = "";
      } else if (formData.fullVideoFile) {
        setProgressText("Uploading full video to S3...");
        setUploadPercent(0);
        setUploadStats({ fileName: formData.fullVideoFile.name });
        const videoUrlRes = await adminFetch(
          "/webhook/internal/video-upload-url",
        );
        if (!videoUrlRes.ok)
          throw new Error("Failed to get video upload authorization");
        const videoUrlData = await videoUrlRes.json();

        await uploadWithProgress(
          videoUrlData.preSignedUrl,
          formData.fullVideoFile,
          "PUT",
          { "Content-Type": formData.fullVideoFile.type || "video/mp4" },
          (p) => {
            setUploadPercent(p.percent);
            setUploadStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
              fileName: formData.fullVideoFile?.name,
            });
          },
          { onRetry: retryHandler },
        );
        setIsRetrying(false);
        setRetryStatusText("");
        tempVideoKey = videoUrlData.key;
        fullVideoKey = song.fullVideoKey;
      }

      // Trigger recovery/reprocessing pipelines if audio or video were replaced
      if (tempSongKey && tempVideoKey) {
        setProgressText("Triggering media recovery pipeline...");
        setUploadPercent(100);
        const recoverRes = await adminFetch(
          `/admin/song/${song.id}/recover-media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tempSongKey, tempVideoKey }),
          },
        );
        if (!recoverRes.ok) {
          const errData = await recoverRes.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to trigger media recovery");
        }
      } else if (tempSongKey) {
        setProgressText("Triggering audio re-encoding pipeline...");
        setUploadPercent(100);
        const reprocessRes = await adminFetch(
          `/admin/song/${song.id}/reprocess-audio`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tempSongKey }),
          },
        );
        if (!reprocessRes.ok) {
          const errData = await reprocessRes.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to trigger audio reprocessing");
        }
      } else if (tempVideoKey) {
        setProgressText("Triggering video processing pipeline...");
        setUploadPercent(100);
        const reprocessRes = await adminFetch(
          `/admin/song/${song.id}/reprocess-video`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tempVideoKey }),
          },
        );
        if (!reprocessRes.ok) {
          const errData = await reprocessRes.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to trigger video reprocessing");
        }
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

      setProgressText("Saving metadata...");
      const res = await adminFetch(`/admin/song/${song.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          artistName: formData.artistName,
          language: formData.language,
          lrclibId: formData.lrclibId.trim() || "0",
          previewStartTime: previewStartTime !== null ? previewStartTime : -1,
          previewEndTime: previewEndTime !== null ? previewEndTime : -1,
          imageKey,
          videoKey,
          fullVideoKey,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update song");
      }

      const updatedSong: SongData = {
        ...song,
        title: formData.title,
        artistName: formData.artistName,
        language: formData.language,
        lrclibId: formData.lrclibId,
        imageKey,
        videoKey: videoKey === "" ? null : (videoKey ?? null),
        fullVideoKey: fullVideoKey === "" ? null : (fullVideoKey ?? null),
        previewStartTime,
        previewEndTime,
      };

      if (onSuccess) {
        onSuccess(updatedSong);
      }
      onClose();
    } catch (err: any) {
      const friendly = getFriendlyUploadErrorMessage(err);
      setError(friendly);
    } finally {
      setSaving(false);
      setUploadPercent(null);
      setUploadStats({});
      setProgressText("");
      setIsRetrying(false);
      setRetryStatusText("");
    }
  };

  const labelCls =
    "block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5";
  const inputCls =
    "w-full bg-black/60 border border-[#282828] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-all";
  const fileCls =
    "w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-[#282828] file:text-xs file:font-semibold file:bg-black/60 file:text-zinc-200 hover:file:bg-white hover:file:text-black file:transition-all cursor-pointer";

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="bg-[#121212] w-full max-w-lg rounded-3xl shadow-2xl border border-[#282828] overflow-hidden text-white flex flex-col max-h-[85vh] my-auto min-h-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#282828] flex items-center justify-between gap-4 bg-black/40 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-black/60 border border-[#282828] overflow-hidden shrink-0 flex items-center justify-center">
              {song.imageKey ? (
                <img
                  src={getImageUrl(song.imageKey, {
                    width: 100,
                    height: 100,
                    focus: "auto",
                    aspectRatio: "1-1",
                  })}
                  alt={song.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-5 h-5 text-zinc-500" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                {song.title}
              </h2>
              <p className="text-xs text-zinc-400 truncate">
                {song.artistName} • ID: {song.id.slice(0, 8)}...
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div className="px-6 py-3.5 bg-rose-500/10 border-b border-rose-500/20 text-xs shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {error.isNetworkError ? (
                <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div>
                <span className="font-bold text-rose-300 block">
                  {error.title ||
                    (error.isNetworkError
                      ? "Network Connection Error"
                      : "Save Failed")}
                </span>
                <span className="text-zinc-400 text-[11px] block mt-0.5">
                  {error.message}
                </span>
              </div>
            </div>
            {error.canRetry !== false && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e)}
                disabled={saving || isRetrying}
                className="px-3 py-1.5 bg-white hover:bg-zinc-200 active:scale-95 text-black rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <RotateCw
                  className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`}
                />
                {isRetrying ? "Retrying..." : "Retry"}
              </button>
            )}
          </div>
        )}

        {/* Form Body */}
        <form
          id="edit-song-form"
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Song Title</label>
              <input
                required
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className={inputCls}
                placeholder="Song title..."
              />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Artist Name</label>
              <input
                required
                type="text"
                value={formData.artistName}
                onChange={(e) =>
                  setFormData({ ...formData, artistName: e.target.value })
                }
                className={inputCls}
                placeholder="Artist name..."
              />
            </div>

            <div>
              <label className={labelCls}>Language</label>
              <input
                required
                type="text"
                value={formData.language}
                onChange={(e) =>
                  setFormData({ ...formData, language: e.target.value })
                }
                className={inputCls}
                placeholder="e.g. Hindi, English"
              />
            </div>

            <div>
              <label className={labelCls}>LRCLIB ID</label>
              <input
                type="text"
                value={formData.lrclibId}
                onChange={(e) =>
                  setFormData({ ...formData, lrclibId: e.target.value })
                }
                className={inputCls}
                placeholder="Optional ID"
              />
            </div>

            {/* Best Part / Preview Timing Segment */}
            <div className="col-span-2 grid grid-cols-2 gap-3 bg-black/40 p-3.5 rounded-2xl border border-[#282828]">
              <div>
                <label className={labelCls + " text-zinc-300 mb-1"}>
                  Preview Start
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-zinc-500 font-bold block mb-1">
                      Min
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      placeholder="0"
                      value={formData.previewStartMin}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          previewStartMin:
                            e.target.value === ""
                              ? ""
                              : Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-black/60 border border-[#282828] rounded-xl px-2.5 py-1.5 text-xs font-mono text-center font-bold text-white focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                  <span className="font-bold text-zinc-500 mt-4">:</span>
                  <div className="flex-1">
                    <span className="text-[10px] text-zinc-500 font-bold block mb-1">
                      Sec
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={formData.previewStartSec}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          previewStartSec:
                            e.target.value === ""
                              ? ""
                              : Math.max(
                                  0,
                                  Math.min(59, parseInt(e.target.value) || 0),
                                ),
                        })
                      }
                      className="w-full bg-black/60 border border-[#282828] rounded-xl px-2.5 py-1.5 text-xs font-mono text-center font-bold text-white focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls + " text-zinc-300 mb-1"}>
                  Preview End
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-zinc-500 font-bold block mb-1">
                      Min
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      placeholder="0"
                      value={formData.previewEndMin}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          previewEndMin:
                            e.target.value === ""
                              ? ""
                              : Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-black/60 border border-[#282828] rounded-xl px-2.5 py-1.5 text-xs font-mono text-center font-bold text-white focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                  <span className="font-bold text-zinc-500 mt-4">:</span>
                  <div className="flex-1">
                    <span className="text-[10px] text-zinc-500 font-bold block mb-1">
                      Sec
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={formData.previewEndSec}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          previewEndSec:
                            e.target.value === ""
                              ? ""
                              : Math.max(
                                  0,
                                  Math.min(59, parseInt(e.target.value) || 0),
                                ),
                        })
                      }
                      className="w-full bg-black/60 border border-[#282828] rounded-xl px-2.5 py-1.5 text-xs font-mono text-center font-bold text-white focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                </div>
              </div>
              <div className="col-span-2 text-[10px] text-zinc-500">
                Audio preview segment for mouse hover. Leave empty to play
                default.
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {/* Audio Track Replacement (Recovery) */}
            <div className="border border-dashed border-[#282828] rounded-2xl p-3 bg-black/40">
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + " mb-0 flex items-center gap-1.5"}>
                  <Music className="w-3.5 h-3.5 text-amber-400" />
                  Replace / Recover Audio Track{" "}
                  <span className="text-zinc-500 normal-case font-normal">
                    (optional)
                  </span>
                </label>
                {formData.audioFile && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        audioFile: null,
                      })
                    }
                    className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 hover:text-white"
                  >
                    Clear Audio
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 mb-2">
                Upload replacement audio (.mp3, .wav, .flac, .aac, .m4a) to replace corrupted media and trigger HLS re-encoding.
              </p>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.flac,.aac,.m4a"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    audioFile: e.target.files?.[0] || null,
                  })
                }
                className={fileCls}
              />
              {formData.audioFile && (
                <div className="mt-2 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Selected: {formData.audioFile.name} ({(formData.audioFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>
              )}
              {saving && formData.audioFile && progressText?.toLowerCase().includes("audio") && (
                <div className="mt-3">
                  <UploadProgressBar
                    percent={uploadPercent ?? 0}
                    statusText={progressText}
                    fileName={uploadStats.fileName}
                    loadedText={uploadStats.loadedText}
                    speedText={uploadStats.speedText}
                    variant="inline"
                    retryStatusText={retryStatusText}
                    isRetrying={isRetrying}
                  />
                </div>
              )}
            </div>

            {/* Cover Image */}
            <div className="border border-dashed border-[#282828] rounded-2xl p-3 bg-black/40">
              <label className={labelCls}>
                Replace Cover Image{" "}
                <span className="text-zinc-500 normal-case font-normal">
                  (optional)
                </span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    imageFile: e.target.files?.[0] || null,
                  })
                }
                className={fileCls}
              />
            </div>

            {/* Canvas Video */}
            <div className="border border-dashed border-[#282828] rounded-2xl p-3 bg-black/40">
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + " mb-0"}>
                  {song.videoKey && !formData.removeVideo
                    ? "Replace Video Canvas"
                    : "Attach Video Canvas"}{" "}
                  <span className="text-zinc-500 normal-case font-normal">
                    (optional)
                  </span>
                </label>
                {song.videoKey && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        removeVideo: !formData.removeVideo,
                        videoFile: null,
                      })
                    }
                    className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
                      formData.removeVideo
                        ? "bg-zinc-800 text-white"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                    }`}
                  >
                    {formData.removeVideo ? "Undo Remove" : "Remove Canvas"}
                  </button>
                )}
              </div>
              {song.videoKey && !formData.removeVideo && (
                <p className="text-[10px] text-emerald-400 font-medium mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Active canvas video attached
                </p>
              )}
              {formData.removeVideo && (
                <p className="text-[10px] text-rose-400 font-bold mb-2">
                  Canvas will be removed on save
                </p>
              )}
              {!formData.removeVideo && (
                <input
                  type="file"
                  accept="video/mp4,video/*"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      videoFile: e.target.files?.[0] || null,
                    })
                  }
                  className={fileCls}
                />
              )}
            </div>

            {/* Full Video */}
            <div className="border border-dashed border-[#282828] rounded-2xl p-3 bg-black/40">
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + " mb-0"}>
                  Full Music Video{" "}
                  <span className="text-zinc-500 normal-case font-normal">
                    (S3 Shaka Stream)
                  </span>
                </label>
                {song.fullVideoKey && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        removeFullVideo: !formData.removeFullVideo,
                        fullVideoFile: null,
                      })
                    }
                    className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
                      formData.removeFullVideo
                        ? "bg-zinc-800 text-white"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                    }`}
                  >
                    {formData.removeFullVideo ? "Undo Remove" : "Remove Stream"}
                  </button>
                )}
              </div>
              {song.fullVideoKey &&
                !formData.removeFullVideo &&
                !formData.fullVideoFile && (
                  <p className="text-[10px] text-emerald-400 font-medium mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Active full video stream attached
                  </p>
                )}
              {formData.removeFullVideo && (
                <p className="text-[10px] text-rose-400 font-bold mb-2">
                  Full video stream will be removed on save
                </p>
              )}
              {!formData.removeFullVideo && (
                <div>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fullVideoFile: e.target.files?.[0] || null,
                      })
                    }
                    className={fileCls}
                  />
                  {formData.fullVideoFile && (
                    <div className="mt-2 text-[11px] text-zinc-300 font-medium">
                      Selected: {formData.fullVideoFile.name} (triggers Shaka
                      Packager)
                    </div>
                  )}
                  {saving && formData.fullVideoFile && progressText?.toLowerCase().includes("video") && (
                    <div className="mt-3">
                      <UploadProgressBar
                        percent={uploadPercent ?? 0}
                        statusText={progressText}
                        fileName={uploadStats.fileName}
                        loadedText={uploadStats.loadedText}
                        speedText={uploadStats.speedText}
                        variant="inline"
                        retryStatusText={retryStatusText}
                        isRetrying={isRetrying}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Real-time Inline Progress Bar when Uploading Files or on Error */}
        {(saving || error) && (
          <div className="px-6 py-3 border-t border-[#282828] bg-[#141414] shrink-0">
            <UploadProgressBar
              percent={uploadPercent ?? 0}
              statusText={progressText || "Transferring media..."}
              fileName={uploadStats.fileName}
              loadedText={uploadStats.loadedText}
              speedText={uploadStats.speedText}
              variant="inline"
              error={error}
              onRetry={() => handleSubmit()}
              onCancel={() => {
                setError(null);
                setSaving(false);
                setIsRetrying(false);
                setRetryStatusText("");
              }}
              retryStatusText={retryStatusText}
              isRetrying={isRetrying}
            />
          </div>
        )}

        {/* Pinned Footer with Actions */}
        <div className="px-6 py-4 border-t border-[#282828] bg-black/40 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="px-5 py-2.5 rounded-full text-xs font-bold text-zinc-400 hover:text-white hover:bg-[#282828] transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            form="edit-song-form"
            disabled={saving}
            type="submit"
            className={`px-6 py-2.5 rounded-full font-bold text-black text-xs transition-all flex items-center justify-center gap-2 ${
              saving
                ? "bg-zinc-400 cursor-not-allowed"
                : "bg-white hover:bg-zinc-200 active:scale-95 shadow-sm"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                <span>{progressText || "Saving..."}</span>
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
