import type { Song } from "@/types";

export function makeSong(id: string, extra: Partial<Song> = {}): Song {
  return { id, title: `Song ${id}`, artistName: `Artist ${id}`, ...extra };
}

export function makeSongs(...ids: string[]): Song[] {
  return ids.map((id) => makeSong(id));
}
