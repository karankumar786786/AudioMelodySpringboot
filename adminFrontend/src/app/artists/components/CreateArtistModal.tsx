"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/feedback/ToastProvider";
import { FieldErrorText } from "@/components/forms/fields";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { fileOrNull, requiredText } from "@/lib/forms/schemas";
import { useUploadProgress } from "@/lib/forms/useUploadProgress";
import { useCreateArtist } from "@/lib/queries/artists";
import {
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
  UploadError,
  uploadToImageKitWithProgress,
} from "@/lib/upload-utils";
import type { UploadErrorState } from "../types";

/** `ArtistListView.post` requires a name; the cover is required so the artist shows in the app. */
const schema = z.object({
  name: requiredText("Artist name"),
  about: z.string().trim(),
  coverImage: fileOrNull.refine((f) => Boolean(f), "Please select a cover image"),
});
type Values = z.infer<typeof schema>;
const DEFAULTS: Values = { name: "", about: "", coverImage: null };

const inputCls =
  "w-full bg-black/60 border border-[#282828] rounded-xl p-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 transition-all aria-[invalid=true]:border-rose-500/60";
const labelCls = "block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider";

export function CreateArtistModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const createArtist = useCreateArtist();
  const progress = useUploadProgress();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadErrorState | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  if (!isOpen) return null;

  const submit = form.handleSubmit(async ({ name, about, coverImage }) => {
    if (!coverImage) return;
    if (!isDeviceOnline()) {
      const offline = getFriendlyUploadErrorMessage(
        new UploadError("You appear to be offline.", { isOffline: true, isNetworkError: true }),
      );
      setUploadError(offline);
      toast(offline.message, "error");
      return;
    }
    setUploading(true);
    setUploadError(null);
    progress.step("Uploading Artist Cover...", coverImage);
    try {
      const coverImageKey = await uploadToImageKitWithProgress(coverImage, "/artists/covers", progress.onProgress, {
        onRetry: progress.onRetry,
      });
      progress.settle();
      await createArtist.mutateAsync({ name, about, coverImageKey });
      toast("Artist created successfully!");
      form.reset(DEFAULTS);
      onClose();
    } catch (err) {
      const friendly = getFriendlyUploadErrorMessage(err);
      setUploadError(friendly);
      toast(`${friendly.title}: ${friendly.message}`, "error");
    } finally {
      setUploading(false);
      progress.reset();
    }
  });

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-artist-heading"
        className="bg-[#121212] w-full max-w-xl rounded-3xl shadow-2xl border border-[#282828] overflow-hidden"
      >
        <div className="p-6 border-b border-[#282828] flex justify-between items-center bg-black/40">
          <h2 id="create-artist-heading" className="text-lg font-bold text-white">
            Add New Artist
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => !uploading && onClose()}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="p-6 space-y-4">
          <div>
            <label htmlFor="artist-name" className={labelCls}>
              Artist Name
            </label>
            <input
              id="artist-name"
              type="text"
              placeholder="e.g. Hans Zimmer"
              aria-invalid={Boolean(errors.name)}
              className={inputCls}
              {...register("name")}
            />
            <FieldErrorText error={errors.name} />
          </div>

          <div>
            <label htmlFor="artist-about" className={labelCls}>
              Biography / About
            </label>
            <textarea
              id="artist-about"
              rows={3}
              placeholder="Brief artist overview..."
              className={inputCls}
              {...register("about")}
            />
          </div>

          <div>
            <label htmlFor="artist-cover" className={labelCls}>
              Cover Avatar
            </label>
            <input
              id="artist-cover"
              type="file"
              accept="image/*"
              aria-invalid={Boolean(errors.coverImage)}
              onChange={(e) =>
                setValue("coverImage", e.target.files?.[0] ?? null, { shouldValidate: Boolean(errors.coverImage) })
              }
              className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-[#282828] file:text-xs file:font-semibold file:bg-black/60 file:text-zinc-200 hover:file:bg-white hover:file:text-black file:transition-all"
            />
            <FieldErrorText error={errors.coverImage} />
          </div>

          {(uploading || uploadError) && (
            <div className="mt-4">
              <UploadProgressBar
                percent={progress.percent ?? 0}
                statusText="Uploading Artist Cover..."
                fileName={watch("coverImage")?.name}
                loadedText={progress.loadedText}
                speedText={progress.speedText}
                variant="inline"
                error={uploadError}
                onRetry={() => submit()}
                onCancel={() => setUploadError(null)}
                retryStatusText={progress.retryText}
                isRetrying={progress.retrying}
              />
            </div>
          )}

          <button
            disabled={uploading}
            type="submit"
            className={`w-full py-3.5 mt-6 rounded-full font-bold text-black flex items-center justify-center gap-3 transition-all ${
              uploading ? "bg-zinc-400 cursor-not-allowed" : "bg-white hover:bg-zinc-200 active:scale-[0.99]"
            }`}
          >
            {uploading ? "Creating Artist..." : "Save Artist"}
          </button>
        </form>
      </div>
    </div>
  );
}
