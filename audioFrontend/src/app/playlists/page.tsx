import type { Metadata } from "next";
import { serverMusicApi } from "@/lib/api/server-client";
import { PlaylistsClientView } from "./PlaylistsClientView";

export const metadata: Metadata = {
  title: "Playlists - One Melody",
  description: "Explore curated playlists for every mood and genre on One Melody. Lossless audio quality.",
  openGraph: {
    title: "Curated Playlists on One Melody",
    description: "Stream curated playlists in high fidelity audio.",
  },
};

export default async function PlaylistsPage() {
  const playlistsRes = await serverMusicApi.playlists.list(1, 30);
  const initialPlaylists = playlistsRes?.data?.data || [];

  return <PlaylistsClientView initialPlaylists={initialPlaylists} />;
}
