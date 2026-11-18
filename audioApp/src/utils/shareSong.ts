import { Share } from "react-native";
import type { Song } from "@/types";

/**
 * Public web player origin. Song links point here so they open in a browser for
 * anyone, and in the app once universal links / app links are configured for it.
 */
export const WEB_PLAYER_URL = (
  process.env.EXPO_PUBLIC_WEB_URL || "https://one-melody.one-org.me"
).replace(/\/+$/, "");

const MAX_META_LENGTH = 120;

type ShareableSong = Pick<Song, "id" | "title" | "artistName" | "imageKey">;

/**
 * https://<web>/song/<id>?t=<title>&a=<artist>&c=<imageKey>
 *
 * The web API needs a login, so the web page can't look up the song while it builds
 * its Open Graph preview. Title, artist and cover key ride along in the query string
 * for the preview; the page fetches the real song once the visitor is signed in.
 */
export function buildSongShareUrl(song: ShareableSong): string {
  const params: string[] = [];
  const add = (key: string, value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) params.push(`${key}=${encodeURIComponent(trimmed.slice(0, MAX_META_LENGTH))}`);
  };
  add("t", song.title);
  add("a", song.artistName);
  // Only bare storage keys; a full URL here would let a link point the preview anywhere.
  if (song.imageKey && !/^https?:/i.test(song.imageKey)) add("c", song.imageKey);

  const query = params.length ? `?${params.join("&")}` : "";
  return `${WEB_PLAYER_URL}/song/${encodeURIComponent(song.id)}${query}`;
}

/** In-app deep link, e.g. audioapp://song/<id>. */
export function buildSongDeepLink(songId: string): string {
  return `audioapp://song/${encodeURIComponent(songId)}`;
}

/**
 * Opens the native share sheet for a song. Resolves to true when the user shared it.
 * Records the share interaction (best effort).
 */
export async function shareSong(song: ShareableSong | null | undefined): Promise<boolean> {
  if (!song?.id) return false;
  const url = buildSongShareUrl(song);
  const byline = song.artistName ? ` by ${song.artistName}` : "";

  try {
    const result = await Share.share(
      {
        title: song.title,
        // Android ignores `url`; keep the link in the message so it's always included.
        message: `Listen to "${song.title}"${byline} on One Melody: ${url}`,
        url,
      },
      { dialogTitle: "Share song", subject: song.title },
    );

    if (result.action === Share.sharedAction) {
      import("@/service/interactionService")
        .then(({ interactionService }) => interactionService.recordShare(song.id))
        .catch(() => {});
      return true;
    }
  } catch (e) {
    console.warn("[shareSong] Share failed:", e);
  }
  return false;
}
