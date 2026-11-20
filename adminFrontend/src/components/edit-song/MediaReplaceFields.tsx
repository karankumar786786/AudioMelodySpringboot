"use client";

import { CheckCircle2, Music } from "lucide-react";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { fileCls, labelCls } from "@/components/forms/fields";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import type { UploadProgress } from "@/lib/forms/useUploadProgress";
import type { EditSongValues } from "./schema";
import type { SongData } from "./types";

const box = "border border-dashed border-[#282828] rounded-2xl p-3 bg-black/40";
const optional = <span className="text-zinc-500 normal-case font-normal">(optional)</span>;

function InlineProgress({ progress, show }: { progress: UploadProgress; show: boolean }) {
  if (!show) return null;
  return (
    <div className="mt-3">
      <UploadProgressBar
        percent={progress.percent ?? 0}
        statusText={progress.text}
        fileName={progress.fileName}
        loadedText={progress.loadedText}
        speedText={progress.speedText}
        variant="inline"
        retryStatusText={progress.retryText}
        isRetrying={progress.retrying}
      />
    </div>
  );
}

function RemoveToggle({ active, onToggle, children }: { active: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
        active ? "bg-zinc-800 text-white" : "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
      }`}
    >
      {children}
    </button>
  );
}

export function MediaReplaceFields({
  form,
  song,
  saving,
  progress,
}: {
  form: UseFormReturn<EditSongValues>;
  song: SongData;
  saving: boolean;
  progress: UploadProgress;
}) {
  const { watch, setValue } = form;
  const [audioFile, fullVideoFile, removeVideo, removeFullVideo] = watch([
    "audioFile",
    "fullVideoFile",
    "removeVideo",
    "removeFullVideo",
  ]);
  const pick = (name: "imageFile" | "audioFile" | "videoFile" | "fullVideoFile") => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValue(name, e.target.files?.[0] ?? null, { shouldDirty: true }),
  });
  const uploadingText = progress.text.toLowerCase();

  return (
    <div className="space-y-3 pt-1">
      <div className={box}>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="edit-song-audio" className={`${labelCls} mb-0 flex items-center gap-1.5`}>
            <Music className="w-3.5 h-3.5 text-amber-400" />
            Replace / Recover Audio Track {optional}
          </label>
          {audioFile && (
            <button
              type="button"
              onClick={() => setValue("audioFile", null)}
              className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 hover:text-white"
            >
              Clear Audio
            </button>
          )}
        </div>
        <p className="text-[10px] text-zinc-400 mb-2">
          Upload replacement audio (.mp3, .wav, .flac, .aac, .m4a) to replace corrupted media and trigger HLS
          re-encoding.
        </p>
        <input
          id="edit-song-audio"
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.aac,.m4a"
          className={fileCls}
          {...pick("audioFile")}
        />
        {audioFile && (
          <div className="mt-2 text-[11px] font-mono text-zinc-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Selected: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          </div>
        )}
        <InlineProgress progress={progress} show={saving && Boolean(audioFile) && uploadingText.includes("audio")} />
      </div>

      <div className={box}>
        <label htmlFor="edit-song-image" className={labelCls}>
          Replace Cover Image {optional}
        </label>
        <input id="edit-song-image" type="file" accept="image/*" className={fileCls} {...pick("imageFile")} />
      </div>

      <div className={box}>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="edit-song-canvas" className={`${labelCls} mb-0`}>
            {song.videoKey && !removeVideo ? "Replace Video Canvas" : "Attach Video Canvas"} {optional}
          </label>
          {song.videoKey && (
            <RemoveToggle
              active={removeVideo}
              onToggle={() => {
                setValue("removeVideo", !removeVideo, { shouldDirty: true });
                setValue("videoFile", null);
              }}
            >
              {removeVideo ? "Undo Remove" : "Remove Canvas"}
            </RemoveToggle>
          )}
        </div>
        {song.videoKey && !removeVideo && (
          <p className="text-[10px] text-zinc-300 font-medium mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Active canvas video attached
          </p>
        )}
        {removeVideo ? (
          <p className="text-[10px] text-rose-400 font-bold mb-2">Canvas will be removed on save</p>
        ) : (
          <input id="edit-song-canvas" type="file" accept="video/mp4,video/*" className={fileCls} {...pick("videoFile")} />
        )}
      </div>

      <div className={box}>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="edit-song-full-video" className={`${labelCls} mb-0`}>
            Full Music Video <span className="text-zinc-500 normal-case font-normal">(S3 Shaka Stream)</span>
          </label>
          {song.fullVideoKey && (
            <RemoveToggle
              active={removeFullVideo}
              onToggle={() => {
                setValue("removeFullVideo", !removeFullVideo, { shouldDirty: true });
                setValue("fullVideoFile", null);
              }}
            >
              {removeFullVideo ? "Undo Remove" : "Remove Stream"}
            </RemoveToggle>
          )}
        </div>
        {song.fullVideoKey && !removeFullVideo && !fullVideoFile && (
          <p className="text-[10px] text-zinc-300 font-medium mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Active full video stream attached
          </p>
        )}
        {removeFullVideo ? (
          <p className="text-[10px] text-rose-400 font-bold mb-2">Full video stream will be removed on save</p>
        ) : (
          <div>
            <input
              id="edit-song-full-video"
              type="file"
              accept="video/*"
              className={fileCls}
              {...pick("fullVideoFile")}
            />
            {fullVideoFile && (
              <div className="mt-2 text-[11px] text-zinc-300 font-medium">
                Selected: {fullVideoFile.name} (triggers Shaka Packager)
              </div>
            )}
            <InlineProgress
              progress={progress}
              show={saving && Boolean(fullVideoFile) && uploadingText.includes("video")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
