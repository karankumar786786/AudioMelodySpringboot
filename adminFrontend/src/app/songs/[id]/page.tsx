"use client";

import { ArrowLeft, Edit2, Loader2, Music } from "lucide-react";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { fmtNum, fmtTime } from "@/components/charts/Charts";
import { EditSongModal } from "@/components/edit-song/EditSongModal";
import { useToast } from "@/components/feedback/ToastProvider";
import { masterUrl } from "@/lib/hls-inspect";
import { getImageUrl } from "@/lib/image-utils";
import { usePermissions } from "@/lib/permissions";
import { type AnalyticsRange, useSongAnalytics } from "@/lib/queries/analytics";
import { useMergeSong, useSong } from "@/lib/queries/songs";
import {
  HeatmapTab,
  Notice,
  OverviewTab,
  QualityTab,
} from "./components/AnalyticsTabs";
import { ChunkInspector } from "./components/ChunkInspector";
import {
  PreviewPlayer,
  type PreviewPlayerHandle,
} from "./components/PreviewPlayer";

const TABS = [
  ["overview", "Overview"],
  ["heatmap", "Listening heatmap"],
  ["quality", "Delivery & quality"],
  ["chunks", "Chunk inspector"],
] as const;
type Tab = (typeof TABS)[number][0];

const RANGES: [AnalyticsRange, string][] = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["90d", "90 days"],
  ["all", "All time"],
];

export default function SongAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [tab, setTab] = useState<Tab>("overview");
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const player = useRef<PreviewPlayerHandle>(null);
  const analytics = useSongAnalytics(id, range);
  const songQuery = useSong(id);
  const mergeSong = useMergeSong();
  const toast = useToast();
  const { can } = usePermissions();

  const data = analytics.data;
  const song = data?.song;
  const seek = (sec: number) => player.current?.seek(sec);

  if (analytics.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading song analytics…
      </div>
    );
  }
  if (analytics.isError || !data || !song) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-zinc-900 text-zinc-500">
          <Music className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Song not found</h2>
        <p className="text-xs text-zinc-400">
          {analytics.error instanceof Error
            ? analytics.error.message
            : "It may have been removed."}
        </p>
        <Link
          href="/songs"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black"
        >
          <ArrowLeft className="h-4 w-4" /> Back to songs
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
      <Link
        href="/songs"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Songs
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-center">
        {song.imageKey ? (
          <img
            src={getImageUrl(song.imageKey, { width: 160, height: 160 })}
            alt=""
            className="h-20 w-20 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-zinc-900 text-zinc-600">
            <Music className="h-8 w-8" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-white">
            {song.title}
          </h1>
          <p className="text-sm text-zinc-400">
            {song.artistName} · {fmtTime(song.duration)} · {song.status} ·{" "}
            {fmtNum(song.totalStreams)} streams
          </p>
          <div className="mt-2">
            {song.songKey ? (
              <PreviewPlayer
                ref={player}
                src={masterUrl(song.songKey)}
                duration={song.duration}
                onTime={setPlayhead}
              />
            ) : (
              <span className="text-xs text-zinc-500">
                No audio for this song yet.
              </span>
            )}
          </div>
        </div>
        {can("song.edit") && songQuery.data && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8">
        <div className="flex gap-1" role="tablist" aria-label="Song analytics">
          {TABS.map(([key, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === key}
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? "border-white font-semibold text-white" : "border-transparent text-zinc-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab !== "chunks" && tab !== "heatmap" && (
          <div className="mb-1.5 inline-flex rounded-lg border border-white/10 p-0.5 text-xs">
            {RANGES.map(([r, label]) => (
              <button
                type="button"
                aria-pressed={range === r}
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-2.5 py-1 ${range === r ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {analytics.isFetching && !analytics.isLoading && (
        <p className="text-[11px] text-zinc-500">Updating…</p>
      )}

      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "heatmap" && (
        <HeatmapTab data={data} onSeek={seek} playhead={playhead} />
      )}
      {tab === "quality" && <QualityTab data={data} />}
      {tab === "chunks" &&
        (song.songKey ? (
          <ChunkInspector
            songKey={song.songKey}
            duration={song.duration}
            title={song.title}
          />
        ) : (
          <Notice>This song has no HLS output to inspect.</Notice>
        ))}

      {songQuery.data && (
        <EditSongModal
          song={editing ? (songQuery.data as never) : null}
          isOpen={editing}
          onClose={() => setEditing(false)}
          onSuccess={(updated) => {
            mergeSong(updated as never);
            toast(`Track "${updated.title}" updated`);
            setEditing(false);
            analytics.refetch();
          }}
        />
      )}
    </div>
  );
}
