import type { Metadata } from "next";
import { HomeClientView } from "./HomeClientView";

export const metadata: Metadata = {
  title: "Home - One Melody",
  description: "Stream high-definition lossless music, explore trending hits, top artists, and curated playlists.",
  openGraph: {
    title: "One Melody - Lossless Audio Streaming",
    description: "Stream high-definition lossless music and curated playlists on One Melody.",
  },
};

export default function HomePage() {
  return <HomeClientView />;
}
