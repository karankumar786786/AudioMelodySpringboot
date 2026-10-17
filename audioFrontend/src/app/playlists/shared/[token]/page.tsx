import type { Metadata } from "next";
import { getServerSession, serverMusicApi } from "@/lib/api/server-client";
import { redirect } from "next/navigation";
import { SharedPlaylistClientView } from "./SharedPlaylistClientView";

interface SharedPlaylistPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({
  params,
}: SharedPlaylistPageProps): Promise<Metadata> {
  const { token } = await params;
  const playlistRes = await serverMusicApi.users.getSharedPlaylist(token);
  const playlist = playlistRes?.data;

  if (!playlist) {
    return {
      title: "Shared Playlist - One Melody",
      description: "Listen to this shared playlist on One Melody.",
    };
  }

  const title = playlist.title || playlist.name || "Shared Playlist";
  const coverUrl = playlist.coverImageKey
    ? `https://ik.imagekit.io/yash1122/${playlist.coverImageKey}?tr=w-800,h-800`
    : "/image.png";

  return {
    title: `${title} - Shared Playlist`,
    description:
      playlist.description ||
      `Listen to "${title}" shared on One Melody in lossless audio quality.`,
    openGraph: {
      title: `${title} on One Melody`,
      description: `Listen to "${title}" shared on One Melody.`,
      images: [{ url: coverUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} on One Melody`,
      description: `Listen to "${title}" shared on One Melody.`,
      images: [coverUrl],
    },
  };
}

export default async function SharedPlaylistPage({
  params,
}: SharedPlaylistPageProps) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    redirect("/signup");
  }

  const { token } = await params;

  const [playlistRes, songsRes] = await Promise.all([
    serverMusicApi.users.getSharedPlaylist(token),
    serverMusicApi.users.getSharedPlaylistSongs(token, 1, 100),
  ]);

  return (
    <SharedPlaylistClientView
      token={token}
      initialPlaylist={playlistRes?.data || null}
      initialSongs={songsRes?.data?.data || []}
    />
  );
}
