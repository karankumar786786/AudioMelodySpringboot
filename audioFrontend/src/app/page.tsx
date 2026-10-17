import type { Metadata } from "next";
import { AuthPage } from "@/components/AuthPage";

export const metadata: Metadata = {
  title: "One Melody - Lossless Audio & Music Streaming",
  description: "Stream high definition lossless audio, albums, and curated playlists on One Melody.",
};

export default function RootPage() {
  return <AuthPage initialMode="signup" />;
}
