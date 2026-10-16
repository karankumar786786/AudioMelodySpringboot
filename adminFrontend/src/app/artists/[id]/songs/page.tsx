"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/adminFetch";
import { Artist } from "@/app/artists/types";
import { ArtistHeroBanner } from "./components/ArtistHeroBanner";
import { ArtistDiscographyTable, DiscographySong } from "./components/ArtistDiscographyTable";

export default function ArtistSongsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [songs, setSongs] = useState<DiscographySong[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Fetch Artist Details
      const artistRes = await adminFetch(`/admin/artist/${id}`);
      if (artistRes.ok) {
        const artistData = await artistRes.json();
        setArtist(artistData);
      }

      // 2. Fetch Artist Songs via public API
      const songsRes = await adminFetch(`/api/artists/${id}/songs?page=0&size=200`);
      if (songsRes.ok) {
        const songsData = await songsRes.json();
        setSongs(songsData.content || []);
      }
    } catch (err) {
      console.error("Failed to fetch artist data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 font-medium animate-pulse">Loading discography...</p>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-8">
        <div className="text-center max-w-md">
          <h2 className="text-3xl font-bold text-white mb-4">Artist Not Found</h2>
          <p className="text-zinc-400 mb-8">
            The artist you are looking for doesn't exist or has been removed from the database.
          </p>
          <Link
            href="/artists"
            className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-8 py-4 rounded-full font-bold transition-all shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Artists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <ArtistHeroBanner artist={artist} />

      {/* Discography Table */}
      <ArtistDiscographyTable songs={songs} />
    </div>
  );
}
