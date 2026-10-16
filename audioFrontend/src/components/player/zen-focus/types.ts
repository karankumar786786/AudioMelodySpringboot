import type { TranscriptionEntry } from "../hooks/useLyrics";

export interface ZenFocusOverlayProps {
  analyser?: AnalyserNode | null;
  currentTime: number;
  duration: number;
  solidBgColor: string;
  onSeek: (time: number) => void;
  transcriptions?: TranscriptionEntry[];
  plainLyrics?: string | null;
  isLoading?: boolean;
  buffered?: number;
}
