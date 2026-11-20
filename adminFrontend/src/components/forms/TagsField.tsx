"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";
import { MultiSelectTagInput } from "@/components/ui/MultiSelectTagInput";
import { FieldErrorText } from "./fields";

export const GENRE_SUGGESTIONS = ["Pop", "Hip-Hop", "Electronic", "R&B", "Rock", "Bollywood", "Indie", "Acoustic", "Ambient"];

/** A comma-separated string field edited as tags (artists, genres). */
export function TagsField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  suggestions,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  suggestions?: string[];
}) {
  const { field, fieldState } = useController({ control, name });
  const value = String(field.value ?? "");
  return (
    <div>
      <MultiSelectTagInput
        label={label}
        placeholder={placeholder}
        suggestions={suggestions}
        values={value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []}
        onChange={(values) => field.onChange(values.join(", "))}
      />
      <FieldErrorText error={fieldState.error} />
    </div>
  );
}
