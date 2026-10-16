import type { TranscriptionEntry } from "../hooks/useLyrics";

export interface PlayerLyricsOverlayProps {
  currentCaption: TranscriptionEntry | null;
  transcriptions?: TranscriptionEntry[];
  plainLyrics?: string | null;
  localTime: number;
  analyser?: AnalyserNode | null;
  onSeek?: (time: number) => void;
  isLoading?: boolean;
}
