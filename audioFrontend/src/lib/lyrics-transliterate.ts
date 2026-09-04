/**
 * Comprehensive Phonetic / Romanization Transliteration Engine
 * Supports:
 * - Korean (Hangul Syllables -> Revised Romanization of Korean)
 * - Japanese (Hiragana & Katakana -> Hepburn Romaji)
 * - Indic / Hindi (Devanagari -> Standard Phonetic Latin / IAST)
 */

import { TranscriptionEntry, WordEntry } from "@/components/player/hooks/useLyrics";

/* ========================================================================= */
/* 1. KOREAN HANGUL -> ROMANIZATION                                          */
/* ========================================================================= */
const HANGUL_CHOSUNG = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s",
  "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
];

const HANGUL_JUNGSUNG = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa",
  "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];

const HANGUL_JONGSUNG = [
  "", "k", "k", "ks", "n", "nj", "nh", "d", "l", "lg",
  "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s",
  "ss", "ng", "j", "ch", "k", "t", "p", "h",
];

function romanizeHangulChar(ch: string): string {
  const code = ch.charCodeAt(0);
  // Standard Unicode Hangul Syllable range: 0xAC00 - 0xD7A3
  if (code < 0xac00 || code > 0xd7a3) return ch;

  const syllableIndex = code - 0xac00;
  const chosungIndex = Math.floor(syllableIndex / (21 * 28));
  const jungsungIndex = Math.floor((syllableIndex % (21 * 28)) / 28);
  const jongsungIndex = syllableIndex % 28;

  const cho = HANGUL_CHOSUNG[chosungIndex] ?? "";
  const jung = HANGUL_JUNGSUNG[jungsungIndex] ?? "";
  const jong = HANGUL_JONGSUNG[jongsungIndex] ?? "";

  return cho + jung + jong;
}

function romanizeKorean(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += romanizeHangulChar(text[i]);
  }
  return result;
}

/* ========================================================================= */
/* 2. JAPANESE KANA -> HEPBURN ROMAJI                                       */
/* ========================================================================= */
const KANA_MAP: Record<string, string> = {
  // Digraphs (Hiragana)
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  じゃ: "ja", じゅ: "ju", じょ: "jo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  // Single Hiragana
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "wo", ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  // Katakana Digraphs
  キャ: "kya", キュ: "kyu", キョ: "kyo",
  シャ: "sha", シュ: "shu", ショ: "sho",
  チャ: "cha", チュ: "chu", チョ: "cho",
  ニャ: "nya", ニュ: "nyu", ニョ: "nyo",
  ヒャ: "hya", ヒュ: "hyu", ヒョ: "hyo",
  ミャ: "mya", ミュ: "myu", ミョ: "myo",
  リャ: "rya", リュ: "ryu", リョ: "ryo",
  ギャ: "gya", ギュ: "gyu", ギョ: "gyo",
  ジャ: "ja", ジュ: "ju", ジョ: "jo",
  ビャ: "bya", ビュ: "byu", ビョ: "byo",
  ピャ: "pya", ピュ: "pyu", ピョ: "pyo",
  // Single Katakana
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o",
  カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko",
  サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so",
  タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to",
  ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no",
  ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho",
  マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo",
  ヤ: "ya", ユ: "yu", ヨ: "yo",
  ラ: "ra", リ: "ri", ル: "ru", レ: "re", ロ: "ro",
  ワ: "wa", ヲ: "wo", ン: "n",
  ガ: "ga", ギ: "gi", グ: "gu", ゲ: "ge", ゴ: "go",
  ザ: "za", ジ: "ji", ズ: "zu", ゼ: "ze", ゾ: "zo",
  ダ: "da", ヂ: "ji", ヅ: "zu", デ: "de", ド: "do",
  バ: "ba", ビ: "bi", ブ: "bu", ベ: "be", ボ: "bo",
  パ: "pa", ピ: "pi", プ: "pu", ペ: "pe", ポ: "po",
  ー: "-",
};

function romanizeJapaneseKana(text: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    // Check 2-character digraphs first
    if (i < text.length - 1) {
      const pair = text.slice(i, i + 2);
      if (KANA_MAP[pair]) {
        result += KANA_MAP[pair];
        i += 2;
        continue;
      }
      // Handle sokuon (っ / ッ) small tsu
      if (text[i] === "っ" || text[i] === "ッ") {
        const nextChar = text[i + 1];
        const nextRomaji = KANA_MAP[nextChar] || "";
        if (nextRomaji && nextRomaji.length > 0) {
          result += nextRomaji[0];
          i++;
          continue;
        }
      }
    }

    const single = text[i];
    if (KANA_MAP[single]) {
      result += KANA_MAP[single];
    } else {
      result += single;
    }
    i++;
  }
  return result;
}

/* ========================================================================= */
/* 3. DEVANAGARI (HINDI) -> PHONETIC LATIN                                  */
/* ========================================================================= */
const DEVANAGARI_MAP: Record<string, string> = {
  अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri",
  ए: "e", ऐ: "ai", ओ: "o", औ: "au",
  क: "ka", ख: "kha", ग: "ga", घ: "gha", ङ: "nga",
  च: "cha", छ: "chha", ज: "ja", झ: "jha", ञ: "nya",
  ट: "ta", ठ: "tha", ड: "da", ढ: "dha", ण: "na",
  त: "ta", थ: "tha", द: "da", ध: "dha", न: "na",
  प: "pa", फ: "pha", ब: "ba", भ: "bha", म: "ma",
  य: "ya", र: "ra", ल: "la", व: "va",
  श: "sha", ष: "sha", स: "sa", ह: "ha",
  // Matras (Vowel signs)
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "ं": "n", "ँ": "n", "ः": "h", "्": "",
};

function romanizeDevanagari(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (DEVANAGARI_MAP[ch] !== undefined) {
      let rom = DEVANAGARI_MAP[ch];
      // If consonant ending in 'a' and followed by a matra or virama, drop the inherent 'a'
      if (rom.endsWith("a") && next && DEVANAGARI_MAP[next] !== undefined && ["ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "्"].includes(next)) {
        rom = rom.slice(0, -1);
      }
      result += rom;
    } else {
      result += ch;
    }
  }
  return result;
}

/* ========================================================================= */
/* DETECT & TRANSLITERATE MAIN EXPORTS                                      */
/* ========================================================================= */

/**
 * Checks if a string contains non-Latin scripts (CJK, Korean, Devanagari, etc.)
 */
export function hasNonLatinCharacters(text: string): boolean {
  return /[\u0900-\u097F\u3040-\u30FF\u31F0-\u31FF\uAC00-\uD7AF\u4E00-\u9FFF]/.test(
    text,
  );
}

/**
 * Transliterates a raw string to phonetic Romanized text.
 */
export function transliterateText(text: string): string {
  if (!text) return "";
  let out = text;
  if (/[\uAC00-\uD7AF]/.test(out)) {
    out = romanizeKorean(out);
  }
  if (/[\u3040-\u30FF]/.test(out)) {
    out = romanizeJapaneseKana(out);
  }
  if (/[\u0900-\u097F]/.test(out)) {
    out = romanizeDevanagari(out);
  }
  return out;
}

/**
 * Transliterates an entire karaoke TranscriptionEntry (both transcript and individual words)
 */
export function transliterateTranscription(
  entry: TranscriptionEntry,
): TranscriptionEntry {
  const romanizedTranscript = transliterateText(entry.transcript);
  const romanizedWords: WordEntry[] = entry.words.map((w) => ({
    ...w,
    text: transliterateText(w.text),
  }));

  return {
    ...entry,
    transcript: romanizedTranscript,
    words: romanizedWords,
  };
}
