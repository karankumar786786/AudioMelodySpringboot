import type { Metadata } from "next";
import { AlbumClientView } from "./AlbumClientView";

interface AlbumPageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({
  params,
}: AlbumPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const albumName = decodeURIComponent(resolvedParams.name);

  return {
    title: `${albumName} - Album`,
    description: `Listen to "${albumName}" on One Melody in high definition lossless audio.`,
    openGraph: {
      title: `${albumName} on One Melody`,
      description: `Stream ${albumName} in high definition audio.`,
      images: [{ url: "/image.png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${albumName} on One Melody`,
      description: `Stream album ${albumName} on One Melody.`,
      images: ["/image.png"],
    },
  };
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const resolvedParams = await params;
  const albumName = decodeURIComponent(resolvedParams.name);
  return <AlbumClientView albumName={albumName} />;
}
