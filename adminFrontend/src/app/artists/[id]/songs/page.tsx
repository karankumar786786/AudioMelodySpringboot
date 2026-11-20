"use client";

import Link from "next/link";
import { use, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { useArtist, useArtistSongs } from "@/lib/queries/artists";
import { ArtistDiscographyTable, type DiscographySong } from "./components/ArtistDiscographyTable";
import { ArtistHeroBanner } from "./components/ArtistHeroBanner";

export default function ArtistSongsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const artistQuery = useArtist(id);
  const songsQuery = useArtistSongs<DiscographySong>(id, { page, size: pageSize });

  const artist = artistQuery.data ?? null;
  const loading = artistQuery.isPending;
  const songs = songsQuery.data?.rows ?? [];
  const totalSongs = songsQuery.data?.total ?? 0;
  const loadingSongs = songsQuery.isFetching;

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
    <div className="min-h-screen bg-black space-y-4">
      {/* Hero Section */}
      <ArtistHeroBanner artist={artist} />

      {/* Discography Table */}
      <ArtistDiscographyTable songs={songs} />

      {/* Pagination Controls */}
      <div className="max-w-7xl mx-auto px-8 md:px-12 pb-12">
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalSongs}
          currentCount={songs.length}
          itemLabel="tracks"
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(0);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          loading={loadingSongs}
        />
      </div>
    </div>
  );
}

