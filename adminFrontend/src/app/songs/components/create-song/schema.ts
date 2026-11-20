import { z } from "zod";
import { fileOrNull, lrclibId, minutes, requiredText, seconds } from "@/lib/forms/schemas";
import type { UploadMode } from "../../types";

/**
 * Matches `SongListView.post`: it needs an audio file (tempSongKey) or a full video
 * (tempVideoKey); the app also needs a title, artist and cover image to list the song.
 */
export const createSongSchema = z
  .object({
    mode: z.enum(["audio", "videoOnly"]),
    title: requiredText("Track title"),
    artistName: requiredText("Artist name"),
    language: z.string().trim(),
    genre: z.string().trim(),
    album: z.string().trim(),
    country: z.string().trim(),
    lrclibId,
    songFile: fileOrNull,
    imageFile: fileOrNull,
    videoFile: fileOrNull,
    fullVideoFile: fileOrNull,
    clipStartMin: minutes,
    clipStartSec: seconds,
    clipEndMin: minutes,
    clipEndSec: seconds,
    previewStartMin: minutes,
    previewStartSec: seconds,
    previewEndMin: minutes,
    previewEndSec: seconds,
  })
  .superRefine((v, ctx) => {
    if (!v.imageFile) ctx.addIssue({ code: "custom", path: ["imageFile"], message: "Please select a cover image" });
    if (v.mode === "audio" && !v.songFile) {
      ctx.addIssue({ code: "custom", path: ["songFile"], message: "Please select an audio file" });
    }
    if (v.mode === "videoOnly" && !v.fullVideoFile) {
      ctx.addIssue({ code: "custom", path: ["fullVideoFile"], message: "Please select a full video file" });
    }
  });

export type CreateSongValues = z.infer<typeof createSongSchema>;

export const createSongDefaults = (mode: UploadMode = "audio"): CreateSongValues => ({
  mode,
  title: "",
  artistName: "",
  language: "Hindi",
  genre: "",
  album: "",
  country: "India",
  lrclibId: "",
  songFile: null,
  imageFile: null,
  videoFile: null,
  fullVideoFile: null,
  clipStartMin: 0,
  clipStartSec: 0,
  clipEndMin: 0,
  clipEndSec: 15,
  previewStartMin: "",
  previewStartSec: "",
  previewEndMin: "",
  previewEndSec: "",
});
