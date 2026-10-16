import type { Metadata } from "next";
import { serverMusicApi } from "@/lib/api/server-client";
import { PlaylistClientView } from "./PlaylistClientView";

interface PlaylistPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PlaylistPageProps): Promise<Metadata> {
  const { id } = await params;
  const playlistRes = await serverMusicApi.playlists.getById(id);
  const playlist = playlistRes?.data;

  if (!playlist) {
    return {
      title: "Playlist - One Melody",
      description: "Listen to featured playlists and collections on One Melody.",
    };
  }

  const playlistTitle = playlist.title || playlist.name || "Playlist";
  const coverUrl = playlist.coverImageKey
    ? `https://ik.imagekit.io/yash1122/${playlist.coverImageKey}?tr=w-800,h-800`
    : "/image.png";

  return {
    title: `${playlistTitle} - Playlist`,
    description:
      playlist.description ||
      `Stream "${playlistTitle}" with ${playlist.totalSongs || 0} tracks on One Melody. Lossless audio quality.`,
    openGraph: {
      title: `${playlistTitle} on One Melody`,
      description: `Listen to ${playlistTitle} curated playlist on One Melody.`,
      images: [{ url: coverUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${playlistTitle} on One Melody`,
      description: `Stream playlist ${playlistTitle} on One Melody.`,
      images: [coverUrl],
    },
  };
}

export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const { id } = await params;

  // Concurrently fetch playlist metadata and songs on the server using cookie auth
  const [playlistRes, songsRes] = await Promise.all([
    serverMusicApi.playlists.getById(id),
    serverMusicApi.playlists.getSongs(id),
  ]);

  return (
    <PlaylistClientView
      id={id}
      initialPlaylist={playlistRes?.data || null}
      initialSongs={songsRes?.data?.data || []}
    />
  );
}
