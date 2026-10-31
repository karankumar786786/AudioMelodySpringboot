import { Song, PlayerSong } from "@/types";

/**
 * Pretty-prints the complete queue state and current playing song to the console.
 */
export function logQueueSnapshot(
  action: string,
  queue: Song[],
  currentIndex: number,
  currentSong?: Song | PlayerSong | null
) {
  const total = queue.length;
  const active =
    currentSong ||
    (currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null);

  const lines: string[] = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎵 [QUEUE STATE: ${action.toUpperCase()}]`,
    `   Index: ${currentIndex} / ${total > 0 ? total - 1 : 0} (Total songs: ${total})`,
    `   Now Playing: ${active ? `"${active.title}" - ${active.artistName} [ID: ${active.id}]` : "None"}`,
  ];

  if (total === 0) {
    lines.push(`   Queue is EMPTY`);
  } else {
    lines.push(`   Queue Songs List:`);
    queue.forEach((song, idx) => {
      let tag = "";
      if (idx === currentIndex) {
        tag = "▶ NOW PLAYING";
      } else if (idx === currentIndex + 1) {
        tag = "⏭ STANDBY 1";
      } else if (idx === currentIndex + 2) {
        tag = "⏭ STANDBY 2";
      } else if (idx < currentIndex) {
        tag = "✔ HISTORY";
      } else {
        tag = "  UPCOMING";
      }

      lines.push(
        `     [${idx.toString().padStart(2, "0")}] [${tag.padEnd(13, " ")}] "${song.title}" - ${song.artistName} (ID: ${song.id})`
      );
    });
  }
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(lines.join("\n"));
}
