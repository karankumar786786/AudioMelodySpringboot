import type { Metadata } from "next";
import { getServerSession } from "@/lib/api/server-client";
import { redirect } from "next/navigation";
import { HomeClientView } from "./HomeClientView";

export const metadata: Metadata = {
  title: "Home - One Melody",
  description: "Stream high-definition lossless music, explore trending hits, top artists, and curated playlists.",
  openGraph: {
    title: "One Melody - Lossless Audio Streaming",
    description: "Stream high-definition lossless music and curated playlists on One Melody.",
  },
};

export default async function HomePage() {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    redirect("/signup");
  }
  return <HomeClientView />;
}
