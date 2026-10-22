import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession, serverMusicApi } from "@/lib/api/server-client";
import { getImageUrl } from "@/lib/image-utils";
import { ArtistClientView } from "./ArtistClientView";

interface ArtistPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ArtistPageProps): Promise<Metadata> {
  const { id } = await params;
  const artistRes = await serverMusicApi.artists.getById(id);
  const artist = artistRes?.data;

  if (!artist) {
    return {
      title: "Artist - One Melody",
      description: "Explore artists and top hits on One Melody.",
    };
  }

  const coverUrl = artist.coverImageKey
    ? getImageUrl(artist.coverImageKey, { width: 600, height: 600 }) ||
      "/image.png"
    : "/image.png";

  return {
    title: `${artist.name} - Songs, Albums & Bio`,
    description:
      artist.about ||
      `Listen to songs, albums, and discography by ${artist.name} on One Melody. Lossless audio streaming.`,
    openGraph: {
      title: `${artist.name} on One Melody`,
      description: `Stream ${artist.name}'s top hits in high definition audio.`,
      images: [{ url: coverUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${artist.name} on One Melody`,
      description: `Listen to ${artist.name}'s discography on One Melody.`,
      images: [coverUrl],
    },
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    redirect("/signup");
  }

  const { id } = await params;

  // Concurrently fetch artist info & initial songs on the server using incoming cookie auth
  const [artistRes, songsRes] = await Promise.all([
    serverMusicApi.artists.getById(id),
    serverMusicApi.artists.getSongs(id, 1, 15),
  ]);

  return (
    <ArtistClientView
      id={id}
      initialArtist={artistRes?.data || null}
      initialSongs={songsRes?.data?.data || []}
    />
  );
}
