import { useQuery } from "@tanstack/react-query";
import { getSongInfo, SongInfoResult } from "@/service/songInfoService";

export function useSongInfo(title?: string | null, artistName?: string | null) {
  const cleanTitle = title?.trim() || "";
  const cleanArtist = artistName?.trim() || "";

  return useQuery<SongInfoResult>({
    queryKey: ["song-description", cleanTitle, cleanArtist],
    queryFn: () => getSongInfo(cleanTitle, cleanArtist),
    enabled: Boolean(cleanTitle || cleanArtist),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 48,
  });
}
