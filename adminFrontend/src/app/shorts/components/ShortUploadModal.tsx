"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  type SongOption,
  useCreateShort,
  useSongSearch,
} from "@/lib/queries/shorts";
import { uploadToS3WithProgress } from "@/lib/upload-utils";

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_SECONDS = 60;

const schema = z.object({
  caption: z.string().max(300, "At most 300 characters").optional(),
});
type FormValues = z.infer<typeof schema>;

/** Reads a local video's duration and size, so obviously bad files are refused before uploading. */
function probe(
  file: File,
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve({
        duration: v.duration,
        width: v.videoWidth,
        height: v.videoHeight,
      });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file can't be read as a video"));
    };
    v.src = url;
  });
}

export function ShortUploadModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateShort();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [songQuery, setSongQuery] = useState("");
  const [song, setSong] = useState<SongOption | null>(null);
  const songs = useSongSearch(songQuery);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { caption: "" },
  });

  if (!isOpen) return null;

  const close = () => {
    if (progress !== null) return; // don't close mid-upload
    reset();
    setFile(null);
    setFileError(null);
    setSong(null);
    setSongQuery("");
    onClose();
  };

  const pick = async (f: File | null) => {
    setFileError(null);
    setFile(null);
    if (!f) return;
    if (!["video/mp4", "video/quicktime"].includes(f.type)) {
      setFileError("Choose an MP4 or MOV video");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError("Videos can be at most 100 MB");
      return;
    }
    try {
      const meta = await probe(f);
      if (meta.duration > MAX_SECONDS + 0.5) {
        setFileError(`Shorts can be at most ${MAX_SECONDS} seconds`);
        return;
      }
      if (meta.width > meta.height) {
        setFileError(
          "This video is landscape; it will be cropped to 9:16. Upload it anyway or pick a vertical video.",
        );
      }
    } catch (e) {
      setFileError((e as Error).message);
      return;
    }
    setFile(f);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!file) {
      setFileError("Choose a video first");
      return;
    }
    setProgress(0);
    try {
      const { key } = await uploadToS3WithProgress(
        file,
        `/admin/shorts/upload-url?contentType=${encodeURIComponent(file.type)}`,
        file.type,
        (p) => setProgress(Math.round(p.percent)),
      );
      await create.mutateAsync({
        rawKey: key,
        caption: values.caption || undefined,
        songId: song?.id ?? null,
      });
      setProgress(null);
      close();
    } catch {
      setProgress(null);
    }
  });

  const uploading = progress !== null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upload a short"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg bg-[#121214] border border-white/10 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Upload a short</h2>
          <button
            type="button"
            onClick={close}
            disabled={uploading}
            className="text-zinc-400 hover:text-white cursor-pointer disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-zinc-400">
            Vertical video (MP4 or MOV, up to 60 s and 100 MB)
          </span>
          <input
            type="file"
            accept="video/mp4,video/quicktime"
            disabled={uploading}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-zinc-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:bg-white file:text-black file:font-semibold"
          />
          {fileError ? (
            <span className="text-xs text-amber-300 mt-1 block">
              {fileError}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-zinc-400">Caption</span>
          <textarea
            {...register("caption")}
            rows={2}
            disabled={uploading}
            className="mt-2 w-full rounded-xl bg-[#18181c] border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="What's this short about?"
          />
          {formState.errors.caption ? (
            <span className="text-xs text-red-300">
              {formState.errors.caption.message}
            </span>
          ) : null}
        </label>

        <div>
          <span className="text-xs font-semibold text-zinc-400">
            Linked song (optional)
          </span>
          {song ? (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-[#18181c] border border-white/10 px-3 py-2">
              <span className="text-sm text-white truncate">
                {song.title}
                {song.artistName ? (
                  <span className="text-zinc-500"> · {song.artistName}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => setSong(null)}
                disabled={uploading}
                className="text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="mt-2 relative">
              <input
                value={songQuery}
                onChange={(e) => setSongQuery(e.target.value)}
                disabled={uploading}
                placeholder="Search the catalog…"
                className="w-full rounded-xl bg-[#18181c] border border-white/10 px-3 py-2 text-sm text-white"
              />
              {songs.data && songs.data.length > 0 ? (
                <ul className="absolute z-10 mt-1 w-full rounded-xl bg-[#18181c] border border-white/10 max-h-48 overflow-auto">
                  {songs.data.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSong(s);
                          setSongQuery("");
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 cursor-pointer"
                      >
                        {s.title}
                        {s.artistName ? (
                          <span className="text-zinc-500">
                            {" "}
                            · {s.artistName}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>

        {uploading ? (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400">
              Uploading… {progress}%
            </span>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={uploading}
            className="px-4 py-2 rounded-full text-sm text-zinc-300 hover:text-white cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!file || uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-bold disabled:opacity-40 cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload
          </button>
        </div>
      </form>
    </div>
  );
}
