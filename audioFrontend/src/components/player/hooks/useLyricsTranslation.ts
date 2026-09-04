"use client";

import { useEffect, useState } from "react";
import {
  translateTranscriptions,
  translatePlainLyrics,
} from "@/lib/google-translate";
import { type TranscriptionEntry } from "./useLyrics";

export function useLyricsTranslation(
  currentSongId: string | undefined,
  transcriptions: TranscriptionEntry[] | null,
  plainLyrics: string | null,
) {
  const [lyricsTargetLang, setLyricsTargetLang] = useState<string>("original");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [displayTranscriptions, setDisplayTranscriptions] = useState<
    TranscriptionEntry[]
  >([]);
  const [displayPlainLyrics, setDisplayPlainLyrics] = useState<string | null>(
    null,
  );
  const [isTranslating, setIsTranslating] = useState(false);

  // Reset translation language to original when song changes
  useEffect(() => {
    setLyricsTargetLang("original");
  }, [currentSongId]);

  // Translate lyrics when transcriptions, plainLyrics, or targetLang changes
  useEffect(() => {
    if (lyricsTargetLang === "original") {
      setDisplayTranscriptions(transcriptions || []);
      setDisplayPlainLyrics(plainLyrics);
      setIsTranslating(false);
      return;
    }

    let isCancelled = false;
    setIsTranslating(true);

    const runTranslation = async () => {
      try {
        if (transcriptions && transcriptions.length > 0) {
          const res = await translateTranscriptions(
            transcriptions,
            lyricsTargetLang,
          );
          if (!isCancelled) {
            setDisplayTranscriptions(res);
            setDisplayPlainLyrics(null);
            setIsTranslating(false);
          }
        } else if (plainLyrics) {
          const res = await translatePlainLyrics(
            plainLyrics,
            lyricsTargetLang,
          );
          if (!isCancelled) {
            setDisplayTranscriptions([]);
            setDisplayPlainLyrics(res);
            setIsTranslating(false);
          }
        } else {
          if (!isCancelled) {
            setDisplayTranscriptions([]);
            setDisplayPlainLyrics(null);
            setIsTranslating(false);
          }
        }
      } catch (e) {
        if (!isCancelled) {
          setDisplayTranscriptions(transcriptions || []);
          setDisplayPlainLyrics(plainLyrics);
          setIsTranslating(false);
        }
      }
    };

    runTranslation();

    return () => {
      isCancelled = true;
    };
  }, [transcriptions, plainLyrics, lyricsTargetLang]);

  return {
    lyricsTargetLang,
    setLyricsTargetLang,
    showLangMenu,
    setShowLangMenu,
    displayTranscriptions,
    displayPlainLyrics,
    isTranslating,
  };
}
