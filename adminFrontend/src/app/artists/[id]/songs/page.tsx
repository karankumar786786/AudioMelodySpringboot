"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { PaginationBar } from "@/components/PaginationBar";
import { adminFetch } from "@/lib/adminFetch";
import { Artist } from "@/app/artists/types";
import { ArtistHeroBanner } from "./components/ArtistHeroBanner";
import { ArtistDiscographyTable, DiscographySong } from "./components/ArtistDiscographyTable";

export default function ArtistSongsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [songs, setSongs] = useState<DiscographySong[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalSongs, setTotalSongs] = useState(0);

  // Fetch Artist Details (once)
  useEffect(() => {
    let isMounted = true;
    adminFetch(`/admin/artist/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) setArtist(data);
      })
      .catch((err) => console.error("Failed to fetch artist details", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Fetch Artist Songs (when page/pageSize changes)
  const fetchArtistSongs = useCallback(async () => {
    try {
      setLoadingSongs(true);
      const res = await adminFetch(`/admin/artist/${id}/songs?page=${page}&size=${pageSize}`);
      if (res.ok) {
        const data = await res.json();
        const content = data.content || [];
        setSongs(content);
        const metaTotal = data.paginationMetaData?.totalCount ?? data.totalElements;
        if (metaTotal !== undefined && metaTotal !== null) {
          setTotalSongs(Number(metaTotal));
        } else if (content.length < pageSize) {
          setTotalSongs(page * pageSize + content.length);
        } else {
          setTotalSongs((page + 1) * pageSize);
        }
      }
    } catch (err) {
      console.error("Failed to fetch artist songs", err);
    } finally {
      setLoadingSongs(false);
    }
  }, [id, page, pageSize]);

  useEffect(() => {
    fetchArtistSongs();
  }, [fetchArtistSongs]);

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

