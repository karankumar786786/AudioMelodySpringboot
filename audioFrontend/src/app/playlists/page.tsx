import type { Metadata } from "next";
import { PlaylistsClientView } from "./PlaylistsClientView";

export const metadata: Metadata = {
  title: "Playlists - One Melody",
  description: "Explore curated playlists for every mood and genre on One Melody. Lossless audio quality.",
  openGraph: {
    title: "Curated Playlists on One Melody",
    description: "Stream curated playlists in high fidelity audio.",
  },
};

export default function PlaylistsPage() {
  return <PlaylistsClientView />;
}
