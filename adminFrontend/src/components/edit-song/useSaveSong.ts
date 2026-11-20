"use client";

import { useState } from "react";
import { useUploadProgress } from "@/lib/forms/useUploadProgress";
import { apiRequest } from "@/lib/http";
import {
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
  UploadError,
  uploadToImageKitWithProgress,
  uploadToS3WithProgress,
} from "@/lib/upload-utils";
import { type EditSongValues, previewTimes } from "./schema";
import type { SaveError, SongData } from "./types";

/**
 * Saves an edited song: uploads any replacement media, starts reprocessing when audio or
 * the full video changed, then PUTs the metadata. Same calls and order as before.
 */
export function useSaveSong(song: SongData | null) {
  const progress = useUploadProgress();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SaveError | null>(null);

  const save = async (values: EditSongValues): Promise<SongData | null> => {
    if (!song) return null;
    if (!isDeviceOnline()) {
      setError(
        getFriendlyUploadErrorMessage(
          new UploadError("You appear to be offline.", {
            isOffline: true,
            isNetworkError: true,
          }),
        ),
      );
      return null;
    }

    setSaving(true);
    setError(null);
    progress.step("Saving changes...");
    const retry = { onRetry: progress.onRetry };

    try {
      let imageKey = song.imageKey;
      if (values.imageFile) {
        progress.step("Uploading new cover image...", values.imageFile);
        imageKey = await uploadToImageKitWithProgress(
          values.imageFile,
          "/songs/images",
          progress.onProgress,
          retry,
        );
        progress.settle();
      }

      let videoKey: string | null | undefined = song.videoKey;
      if (values.removeVideo) {
        videoKey = "";
      } else if (values.videoFile) {
        progress.step("Uploading canvas video...", values.videoFile);
        videoKey = await uploadToImageKitWithProgress(
          values.videoFile,
          "/songs/videos",
          progress.onProgress,
          retry,
        );
        progress.settle();
      }

      let tempSongKey: string | null = null;
      if (values.audioFile) {
        progress.step("Uploading replacement audio to S3...", values.audioFile);
        const res = await uploadToS3WithProgress(
          values.audioFile,
          "/webhook/internal/song-upload-url",
          values.audioFile.type || "audio/mpeg",
          progress.onProgress,
          { ...retry, maxRetries: 4 },
        );
        progress.settle();
        tempSongKey = res.key;
      }

      let fullVideoKey: string | null | undefined = song.fullVideoKey;
      let tempVideoKey: string | null = null;
      if (values.removeFullVideo) {
        fullVideoKey = "";
      } else if (values.fullVideoFile) {
        progress.step("Uploading full video to S3...", values.fullVideoFile);
        const res = await uploadToS3WithProgress(
          values.fullVideoFile,
          "/webhook/internal/video-upload-url",
          values.fullVideoFile.type || "video/mp4",
          progress.onProgress,
          { ...retry, maxRetries: 4 },
        );
        progress.settle();
        tempVideoKey = res.key;
      }

      if (tempSongKey && tempVideoKey) {
        progress.step("Triggering media recovery pipeline...", 100);
        await apiRequest(`/admin/song/${song.id}/recover-media`, {
          method: "POST",
          body: { tempSongKey, tempVideoKey },
          errorMessage: "Failed to trigger media recovery",
        });
      } else if (tempSongKey) {
        progress.step("Triggering audio re-encoding pipeline...", 100);
        await apiRequest(`/admin/song/${song.id}/reprocess-audio`, {
          method: "POST",
          body: { tempSongKey },
          errorMessage: "Failed to trigger audio reprocessing",
        });
      } else if (tempVideoKey) {
        progress.step("Triggering video processing pipeline...", 100);
        await apiRequest(`/admin/song/${song.id}/reprocess-video`, {
          method: "POST",
          body: { tempVideoKey },
          errorMessage: "Failed to trigger video reprocessing",
        });
      }

      const { previewStartTime, previewEndTime } = previewTimes(values);
      progress.step("Saving metadata...");
      await apiRequest(`/admin/song/${song.id}`, {
        method: "PUT",
        body: {
          title: values.title,
          artistName: values.artistName,
          language: values.language,
          album: values.album || undefined,
          genre: values.genre || undefined,
          country: values.country || "India",
          lrclibId: values.lrclibId || "0",
          // -1 tells the API to clear the preview bound.
          previewStartTime: previewStartTime ?? -1,
          previewEndTime: previewEndTime ?? -1,
          imageKey,
          videoKey,
          fullVideoKey,
        },
        errorMessage: "Failed to update song",
      });

      return {
        ...song,
        title: values.title,
        artistName: values.artistName,
        language: values.language,
        album: values.album,
        genre: values.genre,
        country: values.country,
        lrclibId: values.lrclibId,
        imageKey,
        videoKey: videoKey === "" ? null : (videoKey ?? null),
        fullVideoKey: fullVideoKey === "" ? null : (fullVideoKey ?? null),
        previewStartTime,
        previewEndTime,
      };
    } catch (err) {
      setError(getFriendlyUploadErrorMessage(err));
      return null;
    } finally {
      setSaving(false);
      progress.reset();
    }
  };

  const dismissError = () => {
    setError(null);
    setSaving(false);
    progress.reset();
  };

  return { save, saving, error, setError, dismissError, progress };
}
