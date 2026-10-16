export interface FullVideoModalProps {
  /** Shaka-packaged HLS URL e.g. https://…/videos/<songId>/master.m3u8 */
  hlsUrl: string;
  dashUrl?: string;
  title: string;
  artistName: string;
  posterUrl?: string;
  songId?: string;
  /** Audio player's current time to sync on open */
  initialTime?: number;
  onClose: (finalTime?: number) => void;
}

export interface QualityLevel {
  label: string;
  bandwidth: number;
  height: number;
}
