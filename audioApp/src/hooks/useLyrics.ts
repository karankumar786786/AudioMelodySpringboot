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

const LRCLIB_USER_AGENT = "OneMelody/1.0.0 (https://onemelody.com; support@onemelody.com)";

async function fetchLyrics(
  input: string | number
): Promise<{ transcriptions: LyricEntry[]; plainLyrics: string | null }> {
  const query = String(input).trim();
  if (!query) return { transcriptions: [], plainLyrics: null };

  // If input is a direct caption URL (WEBVTT or LRC file)
  if (query.startsWith("http://") || query.startsWith("https://")) {
    try {
      const res = await fetch(query, {
        headers: { "User-Agent": LRCLIB_USER_AGENT },
      });
      if (!res.ok) return { transcriptions: [], plainLyrics: null };
      const text = await res.text();
      return { transcriptions: parseLrcToEntries(text), plainLyrics: null };
    } catch {
      return { transcriptions: [], plainLyrics: null };
    }
  }

  // Fetch from LRCLIB API with custom User-Agent to satisfy Cloudflare rate limiting rules
  const url = `https://lrclib.net/api/get/${encodeURIComponent(query)}`;
  const headers = {
    "User-Agent": LRCLIB_USER_AGENT,
    Accept: "application/json",
  };

  try {
    let res = await fetch(url, { headers });

    // Handle temporary 503 Server Overloaded with a single backoff retry
    if (res.status === 503) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      res = await fetch(url, { headers });
    }

    if (res.status === 404) {
      // Lyrics not found on LRCLIB
      return { transcriptions: [], plainLyrics: null };
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.syncedLyrics && typeof data.syncedLyrics === "string") {
      return { transcriptions: parseLrcToEntries(data.syncedLyrics), plainLyrics: null };
    }
    if (data.plainLyrics && typeof data.plainLyrics === "string") {
      return { transcriptions: [], plainLyrics: data.plainLyrics };
    }
    return { transcriptions: [], plainLyrics: null };
  } catch (error: any) {
    // Only log unexpected non-404 errors to prevent console spam
    if (!error?.message?.includes("404")) {
      console.warn(`[useLyrics] Could not fetch lyrics for LRCLIB ID "${query}":`, error?.message || error);
    }
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
    retry: 1,
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
