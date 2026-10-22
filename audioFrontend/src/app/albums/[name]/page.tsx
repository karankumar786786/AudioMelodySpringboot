import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession, serverMusicApi } from "@/lib/api/server-client";
import { getImageUrl } from "@/lib/image-utils";
import { AlbumClientView } from "./AlbumClientView";

interface AlbumPageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({
  params,
}: AlbumPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const albumName = decodeURIComponent(resolvedParams.name);
  const songs = await serverMusicApi.albums.getByName(albumName);

  const artistName = songs[0]?.artistName || "Various Artists";
  const songWithImage = songs.find((s) => s.imageKey);
  const coverUrl = songWithImage?.imageKey
    ? getImageUrl(songWithImage.imageKey, { width: 500, height: 500 }) ||
      "/image.png"
    : "/image.png";

  return {
    title: `${albumName} - Album by ${artistName}`,
    description: `Listen to "${albumName}" by ${artistName} on One Melody. Lossless audio streaming with ${songs.length} tracks.`,
    openGraph: {
      title: `${albumName} - ${artistName} on One Melody`,
      description: `Stream ${albumName} in high definition audio.`,
      images: [{ url: coverUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${albumName} - ${artistName}`,
      description: `Stream album ${albumName} on One Melody.`,
      images: [coverUrl],
    },
  };
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    redirect("/signup");
  }

  const resolvedParams = await params;
  const albumName = decodeURIComponent(resolvedParams.name);

  // Fetch album tracks on the server using incoming cookie auth
  const songs = await serverMusicApi.albums.getByName(albumName);

  return <AlbumClientView albumName={albumName} initialSongs={songs} />;
}
