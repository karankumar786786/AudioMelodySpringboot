import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export interface LyricEntry {
  text: string;
  start_time_seconds: number;
  end_time_seconds: number;
}

export function parseLrcToEntries(lrcText: string): LyricEntry[] {
  if (!lrcText) return [];
  const lines = lrcText.split("\n");
  const parsedLines: { time: number; text: string }[] = [];

  for (const line of lines) {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (match) {
      const minutes = parseFloat(match[1]);
      const seconds = parseFloat(match[2]);
      const text = match[3].trim();
      const time = minutes * 60 + seconds;
      if (text) parsedLines.push({ time, text });
    }
  }

  parsedLines.sort((a, b) => a.time - b.time);

  return parsedLines.map((item, idx) => {
    const nextTime = idx < parsedLines.length - 1 ? parsedLines[idx + 1].time : item.time + 5;
    return {
      text: item.text,
      start_time_seconds: item.time,
      end_time_seconds: nextTime,
    };
  });
}

async function fetchLyrics(
  lrclibId: string | number
): Promise<{ transcriptions: LyricEntry[]; plainLyrics: string | null }> {
  try {
    const res = await fetch(`https://lrclib.net/api/get/${encodeURIComponent(String(lrclibId))}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.syncedLyrics && typeof data.syncedLyrics === "string") {
      return { transcriptions: parseLrcToEntries(data.syncedLyrics), plainLyrics: null };
    }
    if (data.plainLyrics && typeof data.plainLyrics === "string") {
      return { transcriptions: [], plainLyrics: data.plainLyrics };
    }
    return { transcriptions: [], plainLyrics: null };
  } catch (error) {
    console.warn(`[useLyrics] Error fetching lyrics for LRCLIB ID "${lrclibId}":`, error);
    return { transcriptions: [], plainLyrics: null };
  }
}

export function useLyrics(
  lrclibId: string | number | undefined | null,
  currentTime: number
) {
  const idStr = lrclibId ? String(lrclibId).trim() : "";

  const { data, isLoading } = useQuery({
    queryKey: ["lyrics", idStr],
    queryFn: () => (idStr ? fetchLyrics(idStr) : { transcriptions: [], plainLyrics: null }),
    enabled: Boolean(idStr),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 48,
  });

  const transcriptions = data?.transcriptions || [];
  const plainLyrics = data?.plainLyrics || null;
  const hasLyrics = transcriptions.length > 0 || Boolean(plainLyrics);

  const activeIndex = useMemo(() => {
    if (!transcriptions.length) return -1;
    for (let i = transcriptions.length - 1; i >= 0; i--) {
      if (currentTime >= transcriptions[i].start_time_seconds) {
        return i;
      }
    }
    return -1;
  }, [transcriptions, currentTime]);

  const currentLine = activeIndex >= 0 ? transcriptions[activeIndex] : null;
  const nextLine =
    activeIndex >= 0 && activeIndex < transcriptions.length - 1
      ? transcriptions[activeIndex + 1]
      : transcriptions[0] || null;

  return {
    transcriptions,
    plainLyrics,
    hasLyrics,
    activeIndex,
    currentLine,
    nextLine,
    isLoading,
  };
}
