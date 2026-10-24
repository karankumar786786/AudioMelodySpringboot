import type { Metadata } from "next";
import { PlaylistClientView } from "./PlaylistClientView";

interface PlaylistPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Playlist - One Melody",
    description: "Listen to featured playlists and collections on One Melody.",
    openGraph: {
      title: "Playlist on One Melody",
      description: "Listen to curated playlists on One Melody.",
      images: [{ url: "/image.png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Playlist on One Melody",
      description: "Stream playlists on One Melody.",
      images: ["/image.png"],
    },
  };
}

export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const { id } = await params;
  return <PlaylistClientView id={id} />;
}
