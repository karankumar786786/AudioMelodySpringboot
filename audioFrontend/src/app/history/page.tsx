import type { Metadata } from "next";
import { HistoryClientView } from "./HistoryClientView";

export const metadata: Metadata = {
  title: "Listening History - One Melody",
  description: "View and replay your recently played songs, tracks, and listening history on One Melody.",
};

export default function HistoryPage() {
  return <HistoryClientView />;
}
