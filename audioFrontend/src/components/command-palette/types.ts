export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type TabType = "all" | "songs" | "artists" | "playlists";

export interface NavigableItem {
  id: string;
  historyId?: string;
  type: "song" | "artist" | "playlist" | "history";
  title: string;
  subtitle?: string;
  imageKey?: string;
  data: any;
}
