"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/adminFetch";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    songs: 0,
    artists: 0,
    playlists: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [songsRes, artistsRes, playlistsRes] = await Promise.all([
          adminFetch("/admin/song?page=0&size=1"),
          adminFetch("/admin/artist?page=0&size=1"),
          adminFetch("/admin/playlist?page=0&size=1"),
        ]);

        const [songs, artists, playlists] = await Promise.all([
          songsRes.ok ? songsRes.json() : null,
          artistsRes.ok ? artistsRes.json() : null,
          playlistsRes.ok ? playlistsRes.json() : null,
        ]);

        setStats({
          songs: songs?.paginationMetaData?.activeCount || songs?.paginationMetaData?.totalCount || songs?.content?.length || 0,
          artists: artists?.paginationMetaData?.activeCount || artists?.paginationMetaData?.totalCount || artists?.content?.length || 0,
          playlists: playlists?.paginationMetaData?.activeCount || playlists?.paginationMetaData?.totalCount || playlists?.content?.length || 0,
        });
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const cards = [
    { name: "Total Songs", value: stats.songs, color: "from-blue-500 to-indigo-600", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
    { name: "Total Artists", value: stats.artists, color: "from-purple-500 to-pink-600", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
    { name: "Total Playlists", value: stats.playlists, color: "from-orange-500 to-red-600", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
  ];

  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">System Overview</h1>
        <p className="text-zinc-500 mt-1 text-lg">Detailed analytics and management for your audio library.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {cards.map((card) => (
          <div key={card.name} className="relative group overflow-hidden bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.color} opacity-5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:opacity-10 transition-opacity`} />
            <div className="flex items-center justify-between mb-4">
              <div className={`p-4 rounded-2xl bg-gradient-to-br ${card.color} text-white shadow-lg`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                </svg>
              </div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Active</span>
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
                {loading ? "..." : card.value}
              </span>
              <span className="text-zinc-500 font-medium mt-1">{card.name}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/songs" className="p-6 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-center hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-all">
              Add New Song
            </Link>
            <Link href="/artists" className="p-6 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 text-purple-600 dark:text-purple-400 font-bold text-center hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-all">
              Manage Artists
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">System Status</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Core Engine API</span>
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-full">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
