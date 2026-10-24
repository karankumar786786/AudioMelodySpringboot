import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export interface WordEntry {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionEntry {
  transcript: string;
  start_time_seconds: number;
  end_time_seconds: number;
  words: WordEntry[];
}

export function parseLrcToTranscriptions(lrcText: string): TranscriptionEntry[] {
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
      transcript: item.text,
      start_time_seconds: item.time,
      end_time_seconds: nextTime,
      words: [],
    };
  });
}

async function fetchLyrics(
  input: string
): Promise<{ transcriptions: TranscriptionEntry[]; plainLyrics: string | null }> {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const r = await fetch(input);
    const text = await r.text();

    if (text.includes("WEBVTT")) {
      const lines = text.split("\n");
      const chunks: TranscriptionEntry[] = [];
      let currentChunk: TranscriptionEntry | null = null;
      const timeToSec = (t: string) => {
        const p = t.split(":");
        return p.length === 3
          ? parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseFloat(p[2])
          : parseInt(p[0]) * 60 + parseFloat(p[1]);
      };

      for (const line of lines) {
        const l = line.trim();
        if (!l || l.startsWith("WEBVTT")) continue;
        if (l.includes("-->")) {
          const [s, e] = l.split("-->").map((x) => x.trim());
          currentChunk = {
            start_time_seconds: timeToSec(s),
            end_time_seconds: timeToSec(e),
            transcript: "",
            words: [],
          };
          chunks.push(currentChunk);
        } else if (currentChunk) {
          const wordMatches = Array.from(l.matchAll(/<([\d:.]+)>\s*([^<]+)/g));
          if (wordMatches.length > 0) {
            wordMatches.forEach((m, idx) => {
              const wStart = timeToSec(m[1]);
              const wText = m[2].trim();
              let wEnd = currentChunk!.end_time_seconds;
              if (idx < wordMatches.length - 1) wEnd = timeToSec(wordMatches[idx + 1][1]);
              currentChunk!.words.push({ text: wText, start: wStart, end: wEnd });
            });
            currentChunk.transcript += l.replace(/<[^>]+>/g, "").trim();
          } else {
            currentChunk.transcript += (currentChunk.transcript ? " " : "") + l;
          }
        }
      }
      return { transcriptions: chunks, plainLyrics: null };
    }

    return { transcriptions: parseLrcToTranscriptions(text), plainLyrics: null };
  }

  const res = await fetch(`https://lrclib.net/api/get/${encodeURIComponent(input)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (data.syncedLyrics && typeof data.syncedLyrics === "string") {
    return { transcriptions: parseLrcToTranscriptions(data.syncedLyrics), plainLyrics: null };
  }
  if (data.plainLyrics && typeof data.plainLyrics === "string") {
    return { transcriptions: [], plainLyrics: data.plainLyrics };
  }
  return { transcriptions: [], plainLyrics: null };
}

export function useLyrics(
  lrclibIdOrCaptionUrl: string | undefined,
  currentTime: number
) {
  const input = lrclibIdOrCaptionUrl?.trim();

  const { data, isLoading } = useQuery({
    queryKey: ["lyrics", input],
    queryFn: () => (input ? fetchLyrics(input) : { transcriptions: [], plainLyrics: null }),
    enabled: Boolean(input),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 48,
  });

  const transcriptions = data?.transcriptions || [];
  const plainLyrics = data?.plainLyrics || null;

  const currentCaption = useMemo(() => {
    for (let i = transcriptions.length - 1; i >= 0; i--) {
      const e = transcriptions[i];
      if (currentTime >= e.start_time_seconds) {
        return e;
      }
    }
    return null;
  }, [transcriptions, currentTime]);

  return { currentCaption, transcriptions, plainLyrics, isLoading };
}
