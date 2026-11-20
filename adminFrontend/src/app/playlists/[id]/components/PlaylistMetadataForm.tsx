"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FieldErrorText } from "@/components/forms/fields";
import { requiredText } from "@/lib/forms/schemas";

/** `PlaylistDetailView.put` accepts any name; the form keeps it non-blank like the create view. */
const schema = z.object({
  name: requiredText("Playlist name"),
  description: z.string().trim(),
});
export type PlaylistMetadata = z.infer<typeof schema>;

export function PlaylistMetadataForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: PlaylistMetadata;
  saving: boolean;
  onSave: (values: PlaylistMetadata) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlaylistMetadata>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  return (
    <form
      onSubmit={handleSubmit(onSave)}
      noValidate
      className="space-y-2 pt-1 max-w-xl"
    >
      <input
        type="text"
        aria-label="Playlist name"
        aria-invalid={Boolean(errors.name)}
        placeholder="Playlist name..."
        className="w-full px-3 py-1.5 bg-black/60 border border-white/20 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-white aria-[invalid=true]:border-rose-500/60"
        {...register("name")}
      />
      <FieldErrorText error={errors.name} />
      <textarea
        rows={2}
        aria-label="Playlist description"
        placeholder="Playlist description..."
        className="w-full px-3 py-1.5 bg-black/60 border border-white/20 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-white resize-none"
        {...register("description")}
      />
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          <span>Save</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
