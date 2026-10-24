import type { Metadata } from "next";
import { ArtistClientView } from "./ArtistClientView";

interface ArtistPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Artist - One Melody",
    description: "Explore artists and top hits on One Melody. Lossless audio streaming.",
    openGraph: {
      title: "Artist on One Melody",
      description: "Stream top hits in high definition audio.",
      images: [{ url: "/image.png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Artist on One Melody",
      description: "Listen to artist discography on One Melody.",
      images: ["/image.png"],
    },
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { id } = await params;
  return <ArtistClientView id={id} />;
}
