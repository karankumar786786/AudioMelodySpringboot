"use client";

import type { UseFormReturn } from "react-hook-form";
import { Field, inputCls } from "@/components/forms/fields";
import { GENRE_SUGGESTIONS, TagsField } from "@/components/forms/TagsField";
import { TimeRangeFields } from "@/components/forms/TimeRangeFields";
import type { EditSongValues } from "./schema";

export function SongMetadataFields({
  form,
}: {
  form: UseFormReturn<EditSongValues>;
}) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const text = (name: keyof EditSongValues) => ({
    id: `edit-song-${name}`,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `edit-song-${name}-error` : undefined,
    className: inputCls,
    ...register(name),
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field
        label="Song Title"
        htmlFor="edit-song-title"
        error={errors.title}
        className="col-span-2"
      >
        <input type="text" placeholder="Song title..." {...text("title")} />
      </Field>

      <div className="col-span-2">
        <TagsField
          control={control}
          name="artistName"
          label="Artist Name(s) *"
          placeholder="e.g. Arijit Singh, Shreya Ghoshal"
        />
      </div>

      <Field
        label="Language"
        htmlFor="edit-song-language"
        error={errors.language}
      >
        <input
          type="text"
          placeholder="e.g. Hindi, English"
          {...text("language")}
        />
      </Field>
      <Field label="Album" htmlFor="edit-song-album" error={errors.album}>
        <input type="text" placeholder="e.g. Aashiqui 2" {...text("album")} />
      </Field>
      <Field label="Country" htmlFor="edit-song-country" error={errors.country}>
        <input type="text" placeholder="e.g. India" {...text("country")} />
      </Field>
      <Field
        label="LRCLIB ID"
        htmlFor="edit-song-lrclibId"
        error={errors.lrclibId}
      >
        <input
          type="text"
          inputMode="numeric"
          placeholder="Optional ID"
          {...text("lrclibId")}
        />
      </Field>

      <TagsField
        control={control}
        name="genre"
        label="Genres"
        placeholder="e.g. Pop, Bollywood"
        suggestions={GENRE_SUGGESTIONS}
      />

      <div className="col-span-2">
        <TimeRangeFields
          control={control}
          title="Preview"
          hint="Audio preview segment for mouse hover. Leave empty to play default."
          names={{
            startMin: "previewStartMin",
            startSec: "previewStartSec",
            endMin: "previewEndMin",
            endSec: "previewEndSec",
          }}
        />
      </div>
    </div>
  );
}
