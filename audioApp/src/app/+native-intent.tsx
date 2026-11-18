/**
 * Rewrites incoming links before expo-router resolves them.
 *
 * Supported song links (all open the song screen):
 *   audioapp://song/<id>
 *   https://<web player>/song/<id>?t=...&a=...&c=...   (share links; query is preview-only)
 *   https://<web player>/songs/<id>                    (older web share links)
 *   https://<web player>/home?song=<id>                (web player share modal)
 *
 * Parsed by hand rather than with `URL`, whose React Native implementation is partial.
 */
const SONG_ID = /^[A-Za-z0-9_-]{1,128}$/;

function songRoute(rawId: string | undefined): string | null {
  if (!rawId) return null;
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {}
  return SONG_ID.test(id) ? `/song/${id}` : null;
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // Strip the scheme + host: "https://host/a/b?x" -> "/a/b?x", "audioapp://song/1" -> "song/1".
    let rest = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, (scheme) =>
      /^https?:\/\//i.test(scheme) ? "" : "/",
    );
    if (/^https?:\/\//i.test(path)) rest = rest.replace(/^[^/?#]*/, "");

    const [pathPart, queryPart = ""] = rest.split("#")[0].split("?");
    const segments = pathPart.split("/").filter(Boolean);

    if (segments[0] === "song" || segments[0] === "songs") {
      const route = songRoute(segments[1]);
      if (route) return route;
    }

    if (segments[0] === "home") {
      const match = queryPart.match(/(?:^|&)song=([^&]+)/);
      const route = songRoute(match?.[1]);
      if (route) return route;
    }
  } catch {
    // Fall through to expo-router's default handling.
  }
  return path;
}
