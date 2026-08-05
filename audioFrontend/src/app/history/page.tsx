"use client";

import { useQuery } from "@tanstack/react-query";
import { musicApi, type Song } from "@/lib/api";
import { SongCard } from "@/components/SongCard";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "@/store/player.store";
import { History, Clock } from "lucide-react";
import { useState, useEffect } from "react";

export default function HistoryPage() {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: historyResponse, isLoading } = useQuery({
    queryKey: ["history", systemUser?.id],
    queryFn: () => musicApi.users.getHistory(),
    enabled: !!systemUser?.id,
  });

  const historyEvents = (historyResponse?.data?.data as any) || [];

  if (!isMounted) return null;

  return (
    <div className="px-10 pb-20">
      <section>
        <div className="flex items-center justify-between mb-12 px-2">
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white">
              History
            </h2>
            <div className="h-px w-24 bg-linear-to-r from-primary to-transparent" />
          </div>
          <div className="flex items-center gap-3 text-zinc-500 text-[10px] font-black uppercase tracking-widest italic">
            <Clock size={14} />
            <span>{historyEvents.length} Events Logged</span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="aspect-square bg-zinc-900/40 border border-white/5 rounded-[3rem] animate-pulse"
              />
            ))}
          </div>
        ) : historyEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
            {historyEvents.map((event: any) => (
              <div key={event.historyId} className="group relative">
                <SongCard song={event} />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-32 text-center text-zinc-500 border-2 border-dashed border-zinc-900 rounded-[4rem] font-bold italic tracking-tight uppercase px-10">
            {systemUser
              ? "NO TEMPORAL DATA FOUND"
              : "AUTHENTICATION REQUIRED TO FETCH HISTORY"}
          </div>
        )}
      </section>
    </div>
  );
}
