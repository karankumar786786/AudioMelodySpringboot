import type { Metadata } from "next";
import { ArtistsClientView } from "./ArtistsClientView";

export const metadata: Metadata = {
  title: "Artists & Creators - One Melody",
  description:
    "Explore top music artists, creators, and discographies on One Melody. Lossless audio streaming.",
  openGraph: {
    title: "Top Artists on One Melody",
    description: "Discover the best music creators and albums on One Melody.",
    images: [{ url: "/image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Artists & Creators on One Melody",
    description: "Discover top artists and creators on One Melody.",
  },
};

export default function ArtistsPage() {
  return <ArtistsClientView />;
}
