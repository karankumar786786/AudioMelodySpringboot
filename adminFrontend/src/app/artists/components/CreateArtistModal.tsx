"use client";

import { useState } from "react";
import { type ToastType } from "@/components/Toast";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { adminFetch } from "@/lib/adminFetch";
import {
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
  UploadError,
  uploadToImageKitWithProgress,
} from "@/lib/upload-utils";
import { CreateArtistFormData, ArtistUploadStats, UploadErrorState } from "../types";

interface CreateArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: ToastType) => void;
}

export function CreateArtistModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}: CreateArtistModalProps) {
  const [formData, setFormData] = useState<CreateArtistFormData>({
    name: "",
    about: "",
    dob: "",
    coverImage: null,
  });

  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploadStats, setUploadStats] = useState<ArtistUploadStats>({});
  const [uploadError, setUploadError] = useState<UploadErrorState | null>(null);
  const [retryStatusText, setRetryStatusText] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.coverImage) {
      return showToast("Please select a cover image", "error");
    }

    if (!isDeviceOnline()) {
      const offlineErr = getFriendlyUploadErrorMessage(
        new UploadError("You appear to be offline.", {
          isOffline: true,
          isNetworkError: true,
        }),
      );
      setUploadError(offlineErr);
      showToast(offlineErr.message, "error");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setRetryStatusText("");
    setIsRetrying(false);
    setUploadPercent(0);
    setUploadStats({});

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
      // 1. Upload Cover Image with real-time progress
      const uploadedImageKey = await uploadToImageKitWithProgress(
        formData.coverImage,
        "/artists/covers",
        (p) => {
          setUploadPercent(p.percent);
          setUploadStats({
            loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
            speedText: p.speedText,
          });
        },
        { onRetry: retryHandler },
      );
      setIsRetrying(false);
      setRetryStatusText("");

      // 2. Create Artist in Backend
      const createRes = await adminFetch("/admin/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          about: formData.about,
          coverImageKey: uploadedImageKey,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to create artist");
      }

      showToast("Artist created successfully!", "success");
      setFormData({ name: "", about: "", dob: "", coverImage: null });
      setUploadError(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      const friendly = getFriendlyUploadErrorMessage(err);
      setUploadError(friendly);
      showToast(`${friendly.title}: ${friendly.message}`, "error");
    } finally {
      setUploading(false);
      setUploadPercent(null);
      setUploadStats({});
      setIsRetrying(false);
      setRetryStatusText("");
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#121212] w-full max-w-xl rounded-3xl shadow-2xl border border-[#282828] overflow-hidden">
        <div className="p-6 border-b border-[#282828] flex justify-between items-center bg-black/40">
          <h2 className="text-lg font-bold text-white">Add New Artist</h2>
          <button
            onClick={() => !uploading && onClose()}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
              Artist Name
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g. Hans Zimmer"
              className="w-full bg-black/60 border border-[#282828] rounded-xl p-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
              Biography / About
            </label>
            <textarea
              rows={3}
              value={formData.about}
              onChange={(e) =>
                setFormData({ ...formData, about: e.target.value })
              }
              placeholder="Brief artist overview..."
              className="w-full bg-black/60 border border-[#282828] rounded-xl p-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
              Cover Avatar
            </label>
            <input
              required
              type="file"
              accept="image/*"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  coverImage: e.target.files?.[0] || null,
                })
              }
              className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-[#282828] file:text-xs file:font-semibold file:bg-black/60 file:text-zinc-200 hover:file:bg-white hover:file:text-black file:transition-all"
            />
          </div>

          {(uploading || uploadError) && (
            <div className="mt-4">
              <UploadProgressBar
                percent={uploadPercent || 0}
                statusText="Uploading Artist Cover..."
                fileName={formData.coverImage?.name}
                loadedText={uploadStats.loadedText}
                speedText={uploadStats.speedText}
                variant="inline"
                error={uploadError}
                onRetry={() => handleSubmit()}
                onCancel={() => {
                  setUploadError(null);
                  setRetryStatusText("");
                }}
                retryStatusText={retryStatusText}
                isRetrying={isRetrying}
              />
            </div>
          )}

          <button
            disabled={uploading}
            type="submit"
            className={`w-full py-3.5 mt-6 rounded-full font-bold text-black flex items-center justify-center gap-3 transition-all ${
              uploading
                ? "bg-zinc-400 cursor-not-allowed"
                : "bg-white hover:bg-zinc-200 active:scale-[0.99]"
            }`}
          >
            {uploading ? "Creating Artist..." : "Save Artist"}
          </button>
        </form>
      </div>
    </div>
  );
}
