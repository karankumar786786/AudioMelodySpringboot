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

export function useLyrics(captionUrl: string | undefined, currentTime: number) {
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>(
    [],
  );
  const [currentCaption, setCurrentCaption] =
    useState<TranscriptionEntry | null>(null);

  useEffect(() => {
    if (!captionUrl) {
      setTranscriptions([]);
      return;
    }
    fetch(captionUrl)
      .then(async (r) => {
        const text = await r.text();
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
            const wordMatches = Array.from(
              l.matchAll(/<([\d:.]+)>\s*([^<]+)/g),
            );
            if (wordMatches.length > 0) {
              wordMatches.forEach((m, idx) => {
                const wStart = timeToSec(m[1]);
                const wText = m[2].trim();
                let wEnd = currentChunk!.end_time_seconds;
                if (idx < wordMatches.length - 1)
                  wEnd = timeToSec(wordMatches[idx + 1][1]);
                currentChunk!.words.push({
                  text: wText,
                  start: wStart,
                  end: wEnd,
                });
              });
              currentChunk.transcript += l.replace(/<[^>]+>/g, "").trim();
            } else {
              currentChunk.transcript +=
                (currentChunk.transcript ? " " : "") + l;
            }
          }
        }
        setTranscriptions(chunks);
      })
      .catch(() => setTranscriptions([]));
  }, [captionUrl]);

  useEffect(() => {
    let active: TranscriptionEntry | null = null;
    for (let i = transcriptions.length - 1; i >= 0; i--) {
      const e = transcriptions[i];
      if (
        currentTime >= e.start_time_seconds &&
        currentTime <= e.end_time_seconds
      ) {
        active = e;
        break;
      }
    }
    if (active !== currentCaption) setCurrentCaption(active);
  }, [transcriptions, currentTime]);

  return { currentCaption, transcriptions };
}
