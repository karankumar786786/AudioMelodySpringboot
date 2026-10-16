"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { adminFetch } from "@/lib/adminFetch";
import {
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
  UploadError,
  uploadToImageKitWithProgress,
} from "@/lib/upload-utils";
import type { CreatePlaylistFormData } from "../types";

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const initialFormData: CreatePlaylistFormData = {
  name: "",
  description: "",
  coverImage: null,
  videoFile: null,
};

export function CreatePlaylistModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}: CreatePlaylistModalProps) {
  const [formData, setFormData] = useState<CreatePlaylistFormData>(initialFormData);
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [createProgressText, setCreateProgressText] = useState("");
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploadStats, setUploadStats] = useState<{ loadedText?: string; speedText?: string }>({});
  const [createError, setCreateError] = useState<{
    title?: string;
    message: string;
    isNetworkError?: boolean;
    canRetry?: boolean;
  } | null>(null);
  const [retryStatusText, setRetryStatusText] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isOpen) return null;

  const resetState = () => {
    setFormData(initialFormData);
    setCreating(false);
    setCreateStep(0);
    setCreateProgressText("");
    setUploadPercent(null);
    setUploadStats({});
    setCreateError(null);
    setRetryStatusText("");
    setIsRetrying(false);
  };

  const handleClose = () => {
    if (creating) {
      if (!confirm("Upload in progress. Are you sure you want to cancel?")) return;
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
      setCreateError(offlineErr);
      setCreating(true);
      showToast(offlineErr.message, "error");
      return;
    }

    if (!formData.coverImage) return showToast("Please select a cover image", "error");
    if (!formData.name.trim()) return showToast("Please enter a playlist name", "error");

    setCreating(true);
    setCreateError(null);
    setRetryStatusText("");
    setIsRetrying(false);
    setCreateStep(1);
    setUploadPercent(0);
    setUploadStats({});
    setCreateProgressText("Uploading playlist artwork to ImageKit CDN...");

    const uploadRetryHandler = (attempt: number, maxRetries: number, delayMs: number) => {
      setIsRetrying(true);
      setRetryStatusText(
        `Network issue. Retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt}/${maxRetries})...`,
      );
    };

    try {
      // 1. Upload Cover Image
      const coverImageKey = await uploadToImageKitWithProgress(
        formData.coverImage,
        "/playlists/images",
        (p) => {
          setUploadPercent(p.percent);
          setUploadStats({
            loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
            speedText: p.speedText,
          });
        },
        { onRetry: uploadRetryHandler },
      );

      // 2. Upload Video Teaser (if provided)
      let videoKey: string | undefined;
      if (formData.videoFile) {
        setCreateStep(2);
        setCreateProgressText("Uploading video teaser to ImageKit CDN...");
        setUploadPercent(0);

        videoKey = await uploadToImageKitWithProgress(
          formData.videoFile,
          "/playlists/videos",
          (p) => {
            setUploadPercent(p.percent);
            setUploadStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
            });
          },
          { onRetry: uploadRetryHandler },
        );
      }

      // 3. Register Playlist
      setCreateStep(3);
      setUploadPercent(100);
      setCreateProgressText("Registering curated playlist...");

      const res = await adminFetch("/admin/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          coverImageKey,
          videoKey,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to create playlist");
      }

      showToast("Playlist created successfully!", "success");
      resetState();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Playlist creation failed:", err);
      const friendlyErr = getFriendlyUploadErrorMessage(err);
      setCreateError(friendlyErr);
      showToast(friendlyErr.message, "error");
    } finally {
      setCreating(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#121212] w-full max-w-lg rounded-3xl shadow-2xl border border-[#282828] overflow-hidden flex flex-col text-white">
        <div className="px-6 py-4.5 border-b border-[#282828] flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Create New Playlist</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Curate a collection of tracks for listeners
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {creating && (
            <UploadProgressBar
              percent={uploadPercent ?? 0}
              statusText={createProgressText}
              step={createStep}
              totalSteps={3}
              fileName={formData.coverImage?.name}
              loadedText={uploadStats.loadedText}
              speedText={uploadStats.speedText}
              error={createError}
              retryStatusText={retryStatusText}
              isRetrying={isRetrying}
            />
          )}

          <div>
            <label className={labelCls}>
              Playlist Name <span className="text-red-400">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Chill Beats & Coffee"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              rows={3}
              placeholder="Describe the mood, vibe, or genres in this playlist..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={inputCls + " resize-none"}
            />
          </div>

          <div>
            <label className={labelCls}>
              Cover Artwork <span className="text-red-400">*</span>
            </label>
            <input
              required
              type="file"
              accept="image/*"
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.files?.[0] || null })}
              className={fileCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              Teaser Video Loop <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFormData({ ...formData, videoFile: e.target.files?.[0] || null })}
              className={fileCls}
            />
          </div>

          <div className="pt-4 border-t border-[#282828] flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={creating}
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl border border-[#282828] text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{creating ? "Creating Playlist..." : "Create Playlist"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
