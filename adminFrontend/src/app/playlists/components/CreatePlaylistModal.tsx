"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { FieldErrorText } from "@/components/forms/fields";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { fileOrNull, requiredText } from "@/lib/forms/schemas";
import { useUploadProgress } from "@/lib/forms/useUploadProgress";
import { useCreatePlaylist } from "@/lib/queries/playlists";
import {
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
  UploadError,
  uploadToImageKitWithProgress,
} from "@/lib/upload-utils";

/** `PlaylistListView.post` requires a name; the cover is required for the app's cards. */
export const playlistSchema = z.object({
  name: requiredText("Playlist name"),
  description: z.string().trim(),
  coverImage: fileOrNull.refine(
    (f) => Boolean(f),
    "Please select a cover image",
  ),
  videoFile: fileOrNull,
});
type Values = z.infer<typeof playlistSchema>;
const DEFAULTS: Values = {
  name: "",
  description: "",
  coverImage: null,
  videoFile: null,
};

const inputCls =
  "w-full bg-[#181818] border border-[#282828] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors aria-[invalid=true]:border-rose-500/60";
const labelCls =
  "block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5";
const fileCls =
  "w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer";

export function CreatePlaylistModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const createPlaylist = useCreatePlaylist();
  const progress = useUploadProgress();
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(0);
  const [createError, setCreateError] = useState<ReturnType<
    typeof getFriendlyUploadErrorMessage
  > | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(playlistSchema),
    defaultValues: DEFAULTS,
  });
  const {
    register,
    setValue,
    formState: { errors },
  } = form;

  if (!isOpen) return null;

  const resetAll = () => {
    form.reset(DEFAULTS);
    setCreating(false);
    setStep(0);
    setCreateError(null);
    progress.reset();
  };

  const handleClose = async () => {
    if (creating) {
      const ok = await confirm({
        title: "Cancel the upload?",
        confirmLabel: "Cancel upload",
      });
      if (!ok) return;
    }
    resetAll();
    onClose();
  };

  const submit = form.handleSubmit(
    async ({ name, description, coverImage, videoFile }) => {
      if (!coverImage) return;
      if (!isDeviceOnline()) {
        const offline = getFriendlyUploadErrorMessage(
          new UploadError(
            "You appear to be offline. Please check your connection.",
            {
              isOffline: true,
              isNetworkError: true,
              canRetry: true,
            },
          ),
        );
        setCreateError(offline);
        toast(offline.message, "error");
        return;
      }
      setCreating(true);
      setCreateError(null);
      const retry = { onRetry: progress.onRetry };
      try {
        setStep(1);
        progress.step(
          "Uploading playlist artwork to ImageKit CDN...",
          coverImage,
        );
        const coverImageKey = await uploadToImageKitWithProgress(
          coverImage,
          "/playlists/images",
          progress.onProgress,
          retry,
        );
        progress.settle();

        let videoKey: string | undefined;
        if (videoFile) {
          setStep(2);
          progress.step("Uploading video teaser to ImageKit CDN...", videoFile);
          videoKey = await uploadToImageKitWithProgress(
            videoFile,
            "/playlists/videos",
            progress.onProgress,
            retry,
          );
          progress.settle();
        }

        setStep(3);
        progress.step("Registering curated playlist...", 100);
        await createPlaylist.mutateAsync({
          name,
          description,
          coverImageKey,
          videoKey,
        });
        toast("Playlist created successfully!");
        resetAll();
        onClose();
      } catch (err) {
        console.error("Playlist creation failed:", err);
        const friendly = getFriendlyUploadErrorMessage(err);
        setCreateError(friendly);
        toast(friendly.message, "error");
      } finally {
        setCreating(false);
        progress.settle();
      }
    },
    (errs) => {
      const first = Object.values(errs)[0];
      if (first?.message) toast(String(first.message), "error");
    },
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-playlist-heading"
        className="bg-[#121212] w-full max-w-lg rounded-3xl shadow-2xl border border-[#282828] overflow-hidden flex flex-col text-white"
      >
        <div className="px-6 py-4.5 border-b border-[#282828] flex justify-between items-center">
          <div>
            <h2
              id="create-playlist-heading"
              className="text-lg font-bold text-white"
            >
              Create New Playlist
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Curate a collection of tracks for listeners
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="text-zinc-400 hover:text-white hover:rotate-90 transition-all p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="p-6 space-y-4">
          {(creating || createError) && (
            <UploadProgressBar
              percent={progress.percent ?? 0}
              statusText={progress.text}
              step={step}
              totalSteps={3}
              fileName={progress.fileName}
              loadedText={progress.loadedText}
              speedText={progress.speedText}
              error={createError}
              retryStatusText={progress.retryText}
              isRetrying={progress.retrying}
            />
          )}

          <div>
            <label htmlFor="playlist-name" className={labelCls}>
              Playlist Name <span className="text-red-400">*</span>
            </label>
            <input
              id="playlist-name"
              type="text"
              placeholder="e.g. Chill Beats & Coffee"
              aria-invalid={Boolean(errors.name)}
              className={inputCls}
              {...register("name")}
            />
            <FieldErrorText error={errors.name} />
          </div>

          <div>
            <label htmlFor="playlist-desc" className={labelCls}>
              Description
            </label>
            <textarea
              id="playlist-desc"
              rows={3}
              placeholder="Describe the mood, vibe, or genres in this playlist..."
              className={`${inputCls} resize-none`}
              {...register("description")}
            />
          </div>

          <div>
            <label htmlFor="playlist-cover" className={labelCls}>
              Cover Artwork <span className="text-red-400">*</span>
            </label>
            <input
              id="playlist-cover"
              type="file"
              accept="image/*"
              aria-invalid={Boolean(errors.coverImage)}
              onChange={(e) =>
                setValue("coverImage", e.target.files?.[0] ?? null, {
                  shouldValidate: Boolean(errors.coverImage),
                })
              }
              className={fileCls}
            />
            <FieldErrorText error={errors.coverImage} />
          </div>

          <div>
            <label htmlFor="playlist-video" className={labelCls}>
              Teaser Video Loop{" "}
              <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <input
              id="playlist-video"
              type="file"
              accept="video/*"
              onChange={(e) =>
                setValue("videoFile", e.target.files?.[0] ?? null)
              }
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
              className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {creating ? "Creating Playlist..." : "Create Playlist"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
