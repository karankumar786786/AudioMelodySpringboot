import type { Metadata } from "next";
import { MyPlaylistClientView } from "./MyPlaylistClientView";

interface MyPlaylistPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MyPlaylistPageProps): Promise<Metadata> {
  const { id } = await params;

  if (id === "favourites") {
    return {
      title: "Favourites - One Melody",
      description: "Your saved collection of favourite songs and tracks on One Melody.",
    };
  }

  return {
    title: "Playlist - One Melody",
    description: "Listen to this playlist on One Melody in high definition lossless audio.",
  };
}

export default async function MyPlaylistPage({ params }: MyPlaylistPageProps) {
  const { id } = await params;
  return <MyPlaylistClientView id={id} />;
}