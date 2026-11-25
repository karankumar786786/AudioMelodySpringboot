import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ShortsFeedScreen } from "@/components/shorts/ShortsFeedScreen";

/** /shorts (optionally ?songId=...): the feed as a full-screen modal. */
export default function ShortsModalScreen() {
  const { songId } = useLocalSearchParams<{ songId?: string }>();
  return <ShortsFeedScreen songId={typeof songId === "string" && songId ? songId : undefined} />;
}
