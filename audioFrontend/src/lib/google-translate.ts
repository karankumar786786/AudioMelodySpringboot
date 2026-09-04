import { TranscriptionEntry, WordEntry } from "@/components/player/hooks/useLyrics";
import { transliterateText, transliterateTranscription } from "./lyrics-transliterate";

export interface SupportedLanguage {
  code: string;
  name: string;
  flag?: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "original", name: "Original", flag: "✨" },
  { code: "hinglish", name: "Hinglish (Roman Hindi)", flag: "🇮🇳" },
  { code: "phonetic", name: "Phonetic (Romaji)", flag: "🔤" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "hi", name: "Hindi (हिंदी)", flag: "🇮🇳" },
  { code: "ro", name: "Romanian (Română)", flag: "🇷🇴" },
  { code: "ru", name: "Russian (Русский)", flag: "🇷🇺" },
  { code: "zh-CN", name: "Chinese Simplified (简体中文)", flag: "🇨🇳" },
  { code: "zh-TW", name: "Chinese Traditional (繁體中文)", flag: "🇹🇼" },
  { code: "es", name: "Spanish (Español)", flag: "🇪🇸" },
  { code: "ja", name: "Japanese (日本語)", flag: "🇯🇵" },
  { code: "ko", name: "Korean (한국어)", flag: "🇰🇷" },
  { code: "fr", name: "French (Français)", flag: "🇫🇷" },
  { code: "de", name: "German (Deutsch)", flag: "🇩🇪" },
  { code: "ar", name: "Arabic (العربية)", flag: "🇸🇦" },
  { code: "it", name: "Italian (Italiano)", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese (Português)", flag: "🇧🇷" },
  { code: "pa", name: "Punjabi (ਪੰਜਾਬੀ)", flag: "🇮🇳" },
];

const translationCache = new Map<string, string>();

/**
 * Direct client-side call to Google Translate GTX endpoint (100% frontend).
 */
export async function translateSingleText(text: string, targetLang: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (targetLang === "original") return text;

  if (targetLang === "phonetic") {
    return transliterateText(text);
  }

  if (targetLang === "hinglish") {
    const hindi = await translateSingleText(text, "hi");
    return transliterateText(hindi);
  }

  const cacheKey = `${targetLang}:${trimmed}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(trimmed)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0]
        .map((segment: any) => (Array.isArray(segment) && segment[0] ? segment[0] : ""))
        .join("")
        .trim();

      if (translated) {
        translationCache.set(cacheKey, translated);
        return translated;
      }
    }
    return text;
  } catch (err) {
    console.warn(`[GoogleTranslate] Translation failed for "${trimmed}" to ${targetLang}:`, err);
    return text;
  }
}

/**
 * Translates an array of TranscriptionEntry lines efficiently using batching / single request.
 */
export async function translateTranscriptions(
  entries: TranscriptionEntry[],
  targetLang: string
): Promise<TranscriptionEntry[]> {
  if (!entries || entries.length === 0 || targetLang === "original") {
    return entries;
  }

  if (targetLang === "phonetic") {
    return entries.map((e) => transliterateTranscription(e));
  }

  if (targetLang === "hinglish") {
    const hindiEntries = await translateTranscriptions(entries, "hi");
    return hindiEntries.map((e) => transliterateTranscription(e));
  }

  // Batch lines with newline delimiter for high performance
  const fullText = entries.map((e) => e.transcript.replace(/\n/g, " ")).join("\n");
  const cacheKey = `${targetLang}:batch:${fullText}`;

  if (translationCache.has(cacheKey)) {
    const translatedLines = translationCache.get(cacheKey)!.split("\n");
    return entries.map((e, idx) => ({
      ...e,
      transcript: translatedLines[idx] || e.transcript,
      words: [], // when translated, sentence-level karaoke is used
    }));
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(fullText)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let fullTranslated = "";
    if (Array.isArray(data) && Array.isArray(data[0])) {
      fullTranslated = data[0]
        .map((segment: any) => (Array.isArray(segment) && segment[0] ? segment[0] : ""))
        .join("");
    }

    if (fullTranslated) {
      translationCache.set(cacheKey, fullTranslated);
      const translatedLines = fullTranslated.split("\n");
      return entries.map((e, idx) => ({
        ...e,
        transcript: translatedLines[idx]?.trim() || e.transcript,
        words: [],
      }));
    }

    return entries;
  } catch (err) {
    console.warn(`[GoogleTranslate] Batch translation error:`, err);
    return entries;
  }
}

/**
 * Translates multi-line plain lyrics string.
 */
export async function translatePlainLyrics(
  text: string | null | undefined,
  targetLang: string
): Promise<string | null> {
  if (!text) return null;
  if (targetLang === "original") return text;
  if (targetLang === "phonetic") return transliterateText(text);
  if (targetLang === "hinglish") {
    const hindi = await translateSingleText(text, "hi");
    return transliterateText(hindi);
  }
  return translateSingleText(text, targetLang);
}
