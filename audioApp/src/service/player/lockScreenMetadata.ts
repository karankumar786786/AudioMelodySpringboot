import { AudioPlayer } from "expo-audio";
import { Song, PlayerSong } from "@/types";
import { safeSetActiveForLockScreen } from "@/utils/audioConfig";
import { getImageUrl } from "@/utils";

export interface LockScreenMetadata {
  title: string;
  artist: string;
  albumTitle: string;
  artworkUrl: string | undefined;
}

export const LOCK_SCREEN_OPTIONS = {
  showSeekForward: false,
  showSeekBackward: false,
  showNextTrack: true,
  showPreviousTrack: true,
} as const;

/**
 * Pure: builds the Now Playing metadata (title, artist, album, artwork URL) for a song.
 */
export function buildLockScreenMetadata(song: Song | PlayerSong): LockScreenMetadata {
  const rawImage =
    (song as any).coverUrl ||
    (song as any).posterUrl ||
    (song as any).imageKey ||
    (song as any).image_key ||
    (song as any).imageUrl;

  const artworkUrl =
    (typeof rawImage === "string" && rawImage.startsWith("http")
      ? rawImage
      : getImageUrl(rawImage, {
          width: 500,
          height: 500,
          focus: "auto",
          aspectRatio: "1-1",
          format: "jpg",
          quality: 85,
        })) || undefined;

  return {
    title: song.title || "One Melody",
    artist: song.artistName || "Unknown Artist",
    albumTitle: song.album || "Melody",
    artworkUrl,
  };
}

/**
 * Registers `player` as the Now Playing / lock-screen owner for `song`.
 */
export function activateLockScreenFor(
  player: AudioPlayer,
  song: Song | PlayerSong,
  force = true
): void {
  safeSetActiveForLockScreen(
    player,
    true,
    buildLockScreenMetadata(song),
    LOCK_SCREEN_OPTIONS,
    force
  );
}
