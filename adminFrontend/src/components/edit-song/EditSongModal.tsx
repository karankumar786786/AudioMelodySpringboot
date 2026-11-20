"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  RotateCw,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { getImageUrl } from "@/lib/image-utils";
import { MediaReplaceFields } from "./MediaReplaceFields";
import { SongMetadataFields } from "./SongMetadataFields";
import { type EditSongValues, editSongSchema, toFormValues } from "./schema";
import type { SaveError, SongData } from "./types";
import { useSaveSong } from "./useSaveSong";

interface EditSongModalProps {
  song: SongData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedSong: SongData) => void;
}

function ErrorBanner({
  error,
  onRetry,
  busy,
}: {
  error: SaveError;
  onRetry: () => void;
  busy: boolean;
}) {
  return (
    <div
      role="alert"
      className="px-6 py-3.5 bg-rose-500/10 border-b border-rose-500/20 text-xs shrink-0 flex items-center justify-between gap-3"
    >
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
          onClick={onRetry}
          disabled={busy}
          className="px-3 py-1.5 bg-white hover:bg-zinc-200 active:scale-95 text-black rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          <RotateCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Retrying..." : "Retry"}
        </button>
      )}
    </div>
  );
}

function ModalHeader({
  song,
  onClose,
  saving,
}: {
  song: SongData;
  onClose: () => void;
  saving: boolean;
}) {
  return (
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
          <h2
            id="edit-song-heading"
            className="text-base font-bold text-white truncate"
          >
            {song.title}
          </h2>
          <p className="text-xs text-zinc-400 truncate">
            {song.artistName} • ID: {song.id.slice(0, 8)}... •{" "}
            <span className="text-white font-semibold">
              {(song.totalStreams || 0).toLocaleString()} streams
            </span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => !saving && onClose()}
        disabled={saving}
        aria-label="Close"
        className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 disabled:opacity-40"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

export function EditSongModal({
  song,
  isOpen,
  onClose,
  onSuccess,
}: EditSongModalProps) {
  const [mounted, setMounted] = useState(false);
  const { save, saving, error, dismissError, progress } = useSaveSong(song);
  const form = useForm<EditSongValues>({
    resolver: zodResolver(editSongSchema),
    defaultValues: song ? toFormValues(song) : undefined,
  });

  useEffect(() => setMounted(true), []);

  // Reload the form whenever a different song is opened.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only reset when the song changes
  useEffect(() => {
    if (song) form.reset(toFormValues(song));
    dismissError();
  }, [song]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, saving, onClose]);

  if (!isOpen || !song || !mounted) return null;

  const submit = form.handleSubmit(async (values) => {
    const updated = await save(values);
    if (updated) {
      onSuccess?.(updated);
      onClose();
    }
  });

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking the backdrop closes; Escape is handled on window
    <div
      className="fixed inset-0 z-99999 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-song-heading"
        className="bg-[#121212] w-full max-w-lg rounded-3xl shadow-2xl border border-[#282828] overflow-hidden text-white flex flex-col max-h-[85vh] my-auto min-h-0"
      >
        <ModalHeader song={song} onClose={onClose} saving={saving} />
        {error && (
          <ErrorBanner
            error={error}
            onRetry={() => submit()}
            busy={saving || progress.retrying}
          />
        )}

        <form
          id="edit-song-form"
          onSubmit={submit}
          noValidate
          className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0"
        >
          <SongMetadataFields form={form} />
          <MediaReplaceFields
            form={form}
            song={song}
            saving={saving}
            progress={progress}
          />
        </form>

        {(saving || error) && (
          <div className="px-6 py-3 border-t border-[#282828] bg-[#141414] shrink-0">
            <UploadProgressBar
              percent={progress.percent ?? 0}
              statusText={progress.text || "Transferring media..."}
              fileName={progress.fileName}
              loadedText={progress.loadedText}
              speedText={progress.speedText}
              variant="inline"
              error={error}
              onRetry={() => submit()}
              onCancel={dismissError}
              retryStatusText={progress.retryText}
              isRetrying={progress.retrying}
            />
          </div>
        )}

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
                <span>{progress.text || "Saving..."}</span>
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
