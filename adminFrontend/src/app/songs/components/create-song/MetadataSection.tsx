"use client";

import type { UseFormReturn } from "react-hook-form";
import { Field } from "@/components/forms/fields";
import { GENRE_SUGGESTIONS, TagsField } from "@/components/forms/TagsField";
import { TimeRangeFields } from "@/components/forms/TimeRangeFields";
import type { CreateSongValues } from "./schema";

export const createInputCls =
  "w-full bg-[#181818] border border-[#282828] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors aria-[invalid=true]:border-rose-500/60";

export function MetadataSection({
  form,
}: {
  form: UseFormReturn<CreateSongValues>;
}) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const input = (
    name: "title" | "language" | "album" | "country" | "lrclibId",
  ) => ({
    id: `song-${name}`,
    "aria-invalid": Boolean(errors[name]),
    className: createInputCls,
    ...register(name),
  });

  return (
    <div className="space-y-4">
      <Field
        label={
          <>
            Track Title <span className="text-red-400">*</span>
          </>
        }
        htmlFor="song-title"
        error={errors.title}
      >
        <input type="text" placeholder="e.g. Starboy" {...input("title")} />
      </Field>

      <TagsField
        control={control}
        name="artistName"
        label="Artists (Primary & Collaborators) *"
        placeholder="e.g. The Weeknd, Daft Punk"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Language" htmlFor="song-language" error={errors.language}>
          <input type="text" {...input("language")} />
        </Field>
        <TagsField
          control={control}
          name="genre"
          label="Genres"
          placeholder="e.g. Pop, Synthwave"
          suggestions={GENRE_SUGGESTIONS}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Album" htmlFor="song-album" error={errors.album}>
          <input type="text" placeholder="Optional album" {...input("album")} />
        </Field>
        <Field label="Country" htmlFor="song-country" error={errors.country}>
          <input type="text" placeholder="e.g. India" {...input("country")} />
        </Field>
        <Field
          label="LRCLIB ID"
          htmlFor="song-lrclibId"
          error={errors.lrclibId}
        >
          <input
            type="text"
            inputMode="numeric"
            placeholder="Lyrics sync ID"
            {...input("lrclibId")}
          />
        </Field>
      </div>

      <TimeRangeFields
        control={control}
        title="Preview"
        hint="Audio snack / preview snippet. Leave empty to play the default."
        names={{
          startMin: "previewStartMin",
          startSec: "previewStartSec",
          endMin: "previewEndMin",
          endSec: "previewEndSec",
        }}
      />
    </div>
  );
}
