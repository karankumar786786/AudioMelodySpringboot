import type { Metadata } from "next";
import { SharedPlaylistClientView } from "./SharedPlaylistClientView";

interface SharedPlaylistPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Shared Playlist - One Melody",
    description: "Listen to shared playlists on One Melody.",
    openGraph: {
      title: "Shared Playlist on One Melody",
      description: "Listen to shared playlists on One Melody.",
      images: [{ url: "/image.png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Shared Playlist on One Melody",
      description: "Listen to shared playlists on One Melody.",
      images: ["/image.png"],
    },
  };
}

export default async function SharedPlaylistPage({
  params,
}: SharedPlaylistPageProps) {
  const { token } = await params;
  return <SharedPlaylistClientView token={token} />;
}
