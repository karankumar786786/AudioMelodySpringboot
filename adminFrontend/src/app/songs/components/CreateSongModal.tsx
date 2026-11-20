"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { MediaSection } from "./create-song/MediaSection";
import { MetadataSection } from "./create-song/MetadataSection";
import { ModeTabs } from "./create-song/ModeTabs";
import { type CreateSongValues, createSongDefaults, createSongSchema } from "./create-song/schema";
import { useCreateSong } from "./create-song/useCreateSong";

interface CreateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateSongModal({ isOpen, onClose, onSuccess }: CreateSongModalProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const { create, uploading, step, error, progress, reset } = useCreateSong();
  const form = useForm<CreateSongValues>({
    resolver: zodResolver(createSongSchema),
    defaultValues: createSongDefaults(),
  });
  const mode = form.watch("mode");

  if (!isOpen) return null;

  const close = async () => {
    if (uploading) {
      const ok = await confirm({
        title: "Cancel the upload?",
        description: "The upload in progress will stop.",
        confirmLabel: "Cancel upload",
      });
      if (!ok) return;
    }
    form.reset(createSongDefaults());
    reset();
    onClose();
  };

  const submit = form.handleSubmit(
    async (values) => {
      const result = await create(values);
      if (result.ok) {
        toast("Track created successfully and queued for processing!");
        form.reset(createSongDefaults());
        onSuccess?.();
        onClose();
      } else if (result.message) {
        toast(result.message, "error");
      }
    },
    (errors) => {
      const first = Object.values(errors)[0];
      if (first?.message) toast(String(first.message), "error");
    },
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-song-heading"
        className="bg-[#121212] w-full max-w-4xl rounded-3xl shadow-2xl border border-[#282828] overflow-hidden flex flex-col max-h-[90vh] text-white"
      >
        <div className="px-6 py-4.5 border-b border-[#282828] flex justify-between items-center">
          <div>
            <h2 id="create-song-heading" className="text-lg font-bold text-white">
              Add New Track
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Upload a standard audio track or extract from a full music video</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-zinc-400 hover:text-white hover:rotate-90 transition-all p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ModeTabs
          mode={mode}
          disabled={uploading}
          onChange={(m) => {
            form.setValue("mode", m);
            form.clearErrors();
          }}
        />

        <form onSubmit={submit} noValidate className="flex-1 overflow-y-auto p-6 space-y-6">
          {(uploading || error) && (
            <UploadProgressBar
              percent={progress.percent ?? 0}
              statusText={progress.text}
              step={step}
              totalSteps={3}
              fileName={progress.fileName}
              loadedText={progress.loadedText}
              speedText={progress.speedText}
              error={error}
              retryStatusText={progress.retryText}
              isRetrying={progress.retrying}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetadataSection form={form} />
            <MediaSection form={form} />
          </div>

          <div className="pt-4 border-t border-[#282828] flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={close}
              className="px-5 py-2.5 rounded-xl border border-[#282828] text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
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
