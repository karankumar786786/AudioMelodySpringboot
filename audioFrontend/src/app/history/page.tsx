import type { Metadata } from "next";
import { getServerSession, serverMusicApi } from "@/lib/api/server-client";
import { redirect } from "next/navigation";
import { HistoryClientView } from "./HistoryClientView";

export const metadata: Metadata = {
  title: "Listening History - One Melody",
  description: "View and replay your recently played songs, tracks, and listening history on One Melody.",
};

export default async function HistoryPage() {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    redirect("/signup");
  }

  const historyRes = await serverMusicApi.users.getListeningHistory(1, 20);
  const initialHistory = historyRes?.data || null;

  return <HistoryClientView initialHistory={initialHistory} />;
}
