/**
 * Lyrics-match helpers for Algolia song hits.
 *
 * Song records carry a `lyrics` attribute that is searchable but never retrieved;
 * Algolia returns a short `_snippetResult.lyrics` instead. We surface it only when
 * the query hit the lyrics and did not already fully match the title or artist,
 * so a row explains *why* it matched.
 */

export const LYRICS_SNIPPET_PARAMS = {
  attributesToRetrieve: ["*", "-lyrics"],
  attributesToSnippet: ["lyrics:12"],
  snippetEllipsisText: "…",
};

type MatchLevel = "none" | "partial" | "full";

function level(field: any): MatchLevel {
  return field?.matchLevel ?? "none";
}

/** Returns the raw snippet (with Algolia `<em>` tags) or undefined. */
export function extractLyricsMatch(hit: any): string | undefined {
  const snippet = hit?._snippetResult?.lyrics;
  if (!snippet || level(snippet) === "none" || typeof snippet.value !== "string") {
    return undefined;
  }
  const hl = hit._highlightResult || {};
  if (level(hl.title) === "full" || level(hl.artistName) === "full" || level(hl.name) === "full") {
    return undefined;
  }
  const value = snippet.value.replace(/\s*\n\s*/g, " / ").trim();
  return value || undefined;
}

export interface HighlightPart {
  text: string;
  highlighted: boolean;
}

/** Splits an Algolia highlight string on `<em>` tags; drops any other markup. */
export function splitHighlight(value: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  const re = /<em>(.*?)<\/em>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const clean = (s: string) => s.replace(/<[^>]+>/g, "");
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) parts.push({ text: clean(value.slice(last, m.index)), highlighted: false });
    parts.push({ text: clean(m[1]), highlighted: true });
    last = m.index + m[0].length;
  }
  if (last < value.length) parts.push({ text: clean(value.slice(last)), highlighted: false });
  return parts.filter((p) => p.text);
}
