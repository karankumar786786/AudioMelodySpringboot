"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/http";
import { toSeconds } from "@/lib/forms/schemas";
import { useUploadProgress } from "@/lib/forms/useUploadProgress";
import { queryKeys } from "@/lib/query/keys";
import {
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
  UploadError,
  uploadToImageKitWithProgress,
  uploadToS3WithProgress,
} from "@/lib/upload-utils";
import type { UploadErrorState } from "../../types";
import type { CreateSongValues } from "./schema";

/** A clip bound is sent only when the song has video and the field was filled in. */
const clip = (hasVideo: boolean, v: number | "") => (hasVideo && v !== "" ? v : undefined);

/**
 * Uploads the media (audio or full video to S3, artwork and canvas to ImageKit), then
 * registers the song, which queues it for processing. Same steps as before.
 */
export function useCreateSong() {
  const qc = useQueryClient();
  const progress = useUploadProgress();
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<UploadErrorState | null>(null);

  const reset = () => {
    setUploading(false);
    setStep(0);
    setError(null);
    progress.reset();
  };

  /** Resolves `{ ok: true }` when the song was created, otherwise the error to show. */
  const create = async (v: CreateSongValues): Promise<{ ok: true } | { ok: false; message?: string }> => {
    if (!isDeviceOnline()) {
      const offline = getFriendlyUploadErrorMessage(
        new UploadError("You appear to be offline. Please check your connection.", {
          isOffline: true,
          isNetworkError: true,
          canRetry: true,
        }),
      );
      setError(offline);
      return { ok: false, message: offline.message };
    }
    if (!v.imageFile) return { ok: false };

    setUploading(true);
    setError(null);
    const retry = { onRetry: progress.onRetry };

    try {
      let tempSongKey: string | null = null;
      let tempVideoKey: string | null = null;

      if (v.mode === "audio" && v.songFile) {
        setStep(1);
        progress.step("Uploading audio file to S3 storage...", v.songFile);
        const res = await uploadToS3WithProgress(
          v.songFile,
          "/webhook/internal/song-upload-url",
          v.songFile.type || "audio/mpeg",
          progress.onProgress,
          { ...retry, maxRetries: 4 },
        );
        progress.settle();
        tempSongKey = res.key;
      }

      if (v.mode === "videoOnly" && v.fullVideoFile) {
        setStep(1);
        progress.step("Uploading full music video to S3 storage...", v.fullVideoFile);
        const res = await uploadToS3WithProgress(
          v.fullVideoFile,
          "/webhook/internal/video-upload-url",
          v.fullVideoFile.type || "video/mp4",
          progress.onProgress,
          { ...retry, maxRetries: 4 },
        );
        progress.settle();
        tempVideoKey = res.key;
      }

      setStep(2);
      progress.step("Uploading cover artwork to ImageKit CDN...", v.imageFile);
      const imageKey = await uploadToImageKitWithProgress(v.imageFile, "/songs/images", progress.onProgress, retry);
      progress.settle();

      let videoKey: string | null = null;
      if (v.mode === "audio" && v.videoFile) {
        progress.step("Uploading canvas background loop to ImageKit CDN...", v.videoFile);
        videoKey = await uploadToImageKitWithProgress(v.videoFile, "/songs/videos", progress.onProgress, retry);
        progress.settle();
      }

      setStep(3);
      progress.step("Registering song & scheduling background processing...", 100);

      const hasVideo = v.mode === "videoOnly" || Boolean(v.videoFile);
      await apiRequest("/admin/song", {
        method: "POST",
        body: {
          title: v.title,
          artistName: v.artistName,
          tempSongKey: tempSongKey || undefined,
          tempVideoKey: tempVideoKey || undefined,
          imageKey,
          videoKey,
          clipStartMin: clip(hasVideo, v.clipStartMin),
          clipStartSec: clip(hasVideo, v.clipStartSec),
          clipEndMin: clip(hasVideo, v.clipEndMin),
          clipEndSec: clip(hasVideo, v.clipEndSec),
          previewStartTime: toSeconds(v.previewStartMin, v.previewStartSec),
          previewEndTime: toSeconds(v.previewEndMin, v.previewEndSec),
          language: v.language,
          genre: v.genre || undefined,
          album: v.album || undefined,
          country: v.country || "India",
          lrclibId: v.lrclibId || undefined,
        },
        errorMessage: "Failed to create track record in system",
      });

      qc.invalidateQueries({ queryKey: queryKeys.songs.all });
      qc.invalidateQueries({ queryKey: queryKeys.jobs.ingestion.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      reset();
      return { ok: true };
    } catch (err) {
      console.error("Song creation failed:", err);
      const friendly = getFriendlyUploadErrorMessage(err);
      setError(friendly);
      return { ok: false, message: friendly.message };
    } finally {
      setUploading(false);
      progress.settle();
    }
  };

  return { create, uploading, step, error, progress, reset };
}
