import { z } from "zod";
import {
  fileOrNull,
  fromSeconds,
  lrclibId,
  minutes,
  requiredText,
  seconds,
  toSeconds,
} from "@/lib/forms/schemas";
import type { SongData } from "./types";

/**
 * Matches `SongDetailView.put`: blank title, artist or language are ignored by the API,
 * so the form requires them; album, genre and country may be cleared; LRCLIB is numeric.
 */
export const editSongSchema = z.object({
  title: requiredText("Song title"),
  artistName: requiredText("Artist name"),
  language: requiredText("Language"),
  album: z.string().trim(),
  genre: z.string().trim(),
  country: z.string().trim(),
  lrclibId,
  previewStartMin: minutes,
  previewStartSec: seconds,
  previewEndMin: minutes,
  previewEndSec: seconds,
  imageFile: fileOrNull,
  audioFile: fileOrNull,
  videoFile: fileOrNull,
  fullVideoFile: fileOrNull,
  removeVideo: z.boolean(),
  removeFullVideo: z.boolean(),
});

export type EditSongValues = z.infer<typeof editSongSchema>;

export function toFormValues(song: SongData): EditSongValues {
  const start = fromSeconds(song.previewStartTime);
  const end = fromSeconds(song.previewEndTime);
  return {
    title: song.title || "",
    artistName: song.artistName || "",
    language: song.language || "Hindi",
    album: song.album || "",
    genre: song.genre || "",
    country: song.country || "India",
    lrclibId: song.lrclibId ? String(song.lrclibId) : "",
    previewStartMin: start.min,
    previewStartSec: start.sec,
    previewEndMin: end.min,
    previewEndSec: end.sec,
    imageFile: null,
    audioFile: null,
    videoFile: null,
    fullVideoFile: null,
    removeVideo: false,
    removeFullVideo: false,
  };
}

export function previewTimes(v: EditSongValues) {
  return {
    previewStartTime: toSeconds(v.previewStartMin, v.previewStartSec),
    previewEndTime: toSeconds(v.previewEndMin, v.previewEndSec),
  };
}
