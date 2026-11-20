"use client";

import type { UseFormReturn } from "react-hook-form";
import { FieldErrorText, labelCls } from "@/components/forms/fields";
import { TimeRangeFields } from "@/components/forms/TimeRangeFields";
import type { CreateSongValues } from "./schema";

const fileCls =
  "w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer";
const box = "bg-[#181818] border border-[#282828] rounded-2xl p-4";

type FileName = "imageFile" | "songFile" | "fullVideoFile" | "videoFile";

export function MediaSection({ form }: { form: UseFormReturn<CreateSongValues> }) {
  const {
    setValue,
    watch,
    control,
    formState: { errors },
  } = form;
  const [mode, videoFile] = watch(["mode", "videoFile"]);

  const file = (name: FileName, accept: string, label: React.ReactNode) => (
    <div className={box}>
      <label htmlFor={`song-${name}`} className={labelCls}>
        {label}
      </label>
      <input
        id={`song-${name}`}
        type="file"
        accept={accept}
        aria-invalid={Boolean(errors[name])}
        onChange={(e) => setValue(name, e.target.files?.[0] ?? null, { shouldValidate: Boolean(errors[name]) })}
        className={fileCls}
      />
      <FieldErrorText error={errors[name]} />
    </div>
  );
  const required = <span className="text-red-400">*</span>;

  return (
    <div className="space-y-4">
      {file("imageFile", "image/*", <>Cover Image Artwork {required}</>)}
      {mode === "audio" && file("songFile", "audio/*", <>Audio File (.mp3, .wav, .flac) {required}</>)}
      {mode === "videoOnly" && file("fullVideoFile", "video/*", <>Full Video File (.mp4, .mov, .mkv) {required}</>)}
      {mode === "audio" &&
        file("videoFile", "video/*", <>Canvas Video Loop <span className="text-zinc-500 font-normal">(Optional)</span></>)}

      {(mode === "videoOnly" || videoFile) && (
        <TimeRangeFields
          control={control}
          title="Canvas Loop"
          hint={mode === "videoOnly" ? "Extract from full video" : "Loop duration / bounds"}
          placeholders={["0", "00", "0", "15"]}
          names={{ startMin: "clipStartMin", startSec: "clipStartSec", endMin: "clipEndMin", endSec: "clipEndSec" }}
        />
      )}
    </div>
  );
}
