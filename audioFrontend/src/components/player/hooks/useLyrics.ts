import { useState, useEffect } from "react";

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

// Global in-memory cache for instant lyrics retrieval
const lyricsCache = new Map<
  string,
  { transcriptions: TranscriptionEntry[]; plainLyrics: string | null }
>();

export function useLyrics(
  lrclibIdOrCaptionUrl: string | undefined,
  currentTime: number
) {
  const input = lrclibIdOrCaptionUrl?.trim();
  const cached = input ? lyricsCache.get(input) : undefined;

  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>(
    cached ? cached.transcriptions : []
  );
  const [plainLyrics, setPlainLyrics] = useState<string | null>(
    cached ? cached.plainLyrics : null
  );
  const [currentCaption, setCurrentCaption] = useState<TranscriptionEntry | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!cached && Boolean(input));

  useEffect(() => {
    if (!input) {
      setTranscriptions([]);
      setPlainLyrics(null);
      setCurrentCaption(null);
      setIsLoading(false);
      return;
    }

    // Return from cache immediately if already fetched
    if (lyricsCache.has(input)) {
      const hit = lyricsCache.get(input)!;
      setTranscriptions(hit.transcriptions);
      setPlainLyrics(hit.plainLyrics);
      setIsLoading(false);
      return;
    }

    // Reset previous song lyrics and start loading immediately
    setTranscriptions([]);
    setPlainLyrics(null);
    setCurrentCaption(null);
    setIsLoading(true);

    let isMounted = true;

    if (input.startsWith("http://") || input.startsWith("https://")) {
      fetch(input)
        .then(async (r) => {
          const text = await r.text();
          if (!isMounted) return;

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
                currentChunk = { start_time_seconds: timeToSec(s), end_time_seconds: timeToSec(e), transcript: "", words: [] };
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
            lyricsCache.set(input, { transcriptions: chunks, plainLyrics: null });
            setTranscriptions(chunks);
            setPlainLyrics(null);
            setIsLoading(false);
          } else {
            const parsed = parseLrcToTranscriptions(text);
            lyricsCache.set(input, { transcriptions: parsed, plainLyrics: null });
            setTranscriptions(parsed);
            setPlainLyrics(null);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setTranscriptions([]);
            setPlainLyrics(null);
            setIsLoading(false);
          }
        });
    } else {
      // Fetch from LRCLIB API by ID
      fetch(`https://lrclib.net/api/get/${encodeURIComponent(input)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (!isMounted) return;

          if (data.syncedLyrics && typeof data.syncedLyrics === "string") {
            const parsed = parseLrcToTranscriptions(data.syncedLyrics);
            lyricsCache.set(input, { transcriptions: parsed, plainLyrics: null });
            setTranscriptions(parsed);
            setPlainLyrics(null);
          } else if (data.plainLyrics && typeof data.plainLyrics === "string") {
            lyricsCache.set(input, { transcriptions: [], plainLyrics: data.plainLyrics });
            setTranscriptions([]);
            setPlainLyrics(data.plainLyrics);
          } else {
            lyricsCache.set(input, { transcriptions: [], plainLyrics: null });
            setTranscriptions([]);
            setPlainLyrics(null);
          }
          setIsLoading(false);
        })
        .catch(() => {
          if (isMounted) {
            setTranscriptions([]);
            setPlainLyrics(null);
            setIsLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [input]);

  useEffect(() => {
    let active: TranscriptionEntry | null = null;
    for (let i = transcriptions.length - 1; i >= 0; i--) {
      const e = transcriptions[i];
      if (currentTime >= e.start_time_seconds) {
        active = e;
        break;
      }
    }
    if (active !== currentCaption) setCurrentCaption(active);
  }, [transcriptions, currentTime]);

  return { currentCaption, transcriptions, plainLyrics, isLoading };
}
