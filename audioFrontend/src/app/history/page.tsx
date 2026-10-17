import type { Metadata } from "next";
import { serverMusicApi } from "@/lib/api/server-client";
import { HistoryClientView } from "./HistoryClientView";

export const metadata: Metadata = {
  title: "Listening History - One Melody",
  description: "View and replay your recently played songs, tracks, and listening history on One Melody.",
};

export default async function HistoryPage() {
  const historyRes = await serverMusicApi.users.getListeningHistory(1, 20);
  const initialHistory = historyRes?.data || null;

  return <HistoryClientView initialHistory={initialHistory} />;
}
