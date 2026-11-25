"use client";

import { Headphones, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, Kpi, Notice } from "@/app/songs/[id]/components/AnalyticsTabs";
import {
  BarList,
  fmtNum,
  fmtPct,
  Legend,
  LineChart,
  SERIES,
} from "@/components/charts/Charts";
import {
  type AnalyticsRange,
  useAnalyticsOverview,
} from "@/lib/queries/analytics";

const RANGES: [AnalyticsRange, string][] = [
  ["7d", "7d"],
  ["30d", "30d"],
  ["90d", "90d"],
];

function SongLink({
  id,
  title,
  artist,
}: {
  id: string;
  title: string | null;
  artist: string | null;
}) {
  return (
    <Link href={`/songs/${id}`} className="hover:text-white hover:underline">
      {title ?? id}
      {artist && <span className="text-zinc-500"> · {artist}</span>}
    </Link>
  );
}

/** Listening across the catalogue (admin/analytics/overview). */
export function ListeningOverview() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const q = useAnalyticsOverview(range);
  const d = q.data;
  return (
    <section className="space-y-4" aria-labelledby="listening-heading">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="listening-heading"
          className="flex items-center gap-2 text-lg font-bold"
        >
          <Headphones className="h-5 w-5 text-zinc-400" /> Listening
        </h2>
        <div className="inline-flex rounded-lg border border-white/10 p-0.5 text-xs">
          {RANGES.map(([r, l]) => (
            <button
              type="button"
              aria-pressed={range === r}
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 ${range === r ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {q.isPending && (
        <p className="flex items-center gap-2 text-xs text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading listening
          data…
        </p>
      )}
      {q.isError && (
        <Notice>Listening analytics are unavailable right now.</Notice>
      )}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi
              label="Plays"
              value={fmtNum(d.kpis.current.plays)}
              change={d.kpis.change.plays}
            />
            <Kpi
              label="Listeners"
              value={fmtNum(d.kpis.current.listeners)}
              change={d.kpis.change.listeners}
            />
            <Kpi
              label="Qualified streams"
              value={fmtNum(d.kpis.current.qualifiedStreams)}
              change={d.kpis.change.qualifiedStreams}
            />
            <Kpi
              label="Completion rate"
              value={fmtPct(d.kpis.current.completionRate)}
              change={d.kpis.change.completionRate}
            />
            <Kpi
              label="Skip rate"
              value={fmtPct(d.kpis.current.skipRate)}
              sub={
                d.kpis.current.skipRate === null ? "needs events" : undefined
              }
            />
            <Kpi
              label="Listening hours"
              value={fmtNum(d.kpis.current.listenedHours, 1)}
              change={d.kpis.change.listenedHours}
            />
          </div>

          <Card title="Plays and listeners per day">
            {d.daily.length ? (
              <>
                <Legend
                  items={[
                    { label: "Plays", color: SERIES[0] },
                    ...(d.daily.some((x) => x.listeners !== undefined)
                      ? [{ label: "Listeners", color: SERIES[1] }]
                      : []),
                  ]}
                />
                <LineChart
                  ariaLabel="Plays and listeners per day"
                  x={d.daily.map((x) => x.day)}
                  formatX={(v) => String(v).slice(5)}
                  series={[
                    {
                      key: "plays",
                      label: "Plays",
                      color: SERIES[0],
                      values: d.daily.map((x) => x.plays),
                    },
                    ...(d.daily.some((x) => x.listeners !== undefined)
                      ? [
                          {
                            key: "listeners",
                            label: "Listeners",
                            color: SERIES[1],
                            values: d.daily.map((x) => x.listeners ?? null),
                          },
                        ]
                      : []),
                  ]}
                />
              </>
            ) : (
              <p className="text-xs text-zinc-500">No plays in this range.</p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Top songs" hint="By plays, with completion rate.">
              {d.topSongs.length ? (
                <BarList
                  items={d.topSongs.map((s) => ({
                    key: s.songId,
                    label: (
                      <>
                        <SongLink
                          id={s.songId}
                          title={s.title}
                          artist={s.artistName}
                        />{" "}
                        · {fmtPct(s.completionRate)}
                      </>
                    ),
                    value: s.plays,
                  }))}
                />
              ) : (
                <p className="text-xs text-zinc-500">No plays yet.</p>
              )}
            </Card>
            <Card
              title="Most skipped intros"
              hint="Share of plays abandoned in the first 30 s (20+ plays)."
            >
              {d.skippedIntros.length ? (
                <BarList
                  color={SERIES[1]}
                  items={d.skippedIntros.map((s) => ({
                    key: s.songId,
                    label: (
                      <SongLink
                        id={s.songId}
                        title={s.title}
                        artist={s.artistName}
                      />
                    ),
                    value: s.earlyExitRate,
                  }))}
                  format={(v) => fmtPct(v)}
                />
              ) : (
                <p className="text-xs text-zinc-500">
                  {d.lake.available
                    ? "Not enough plays yet."
                    : "Needs the data lake."}
                </p>
              )}
            </Card>
            <Card
              title="Quality mix"
              hint="Plays per rendition, with average startup."
            >
              {d.qualityMix.length ? (
                <BarList
                  color={SERIES[2]}
                  items={d.qualityMix.map((m) => ({
                    key: m.quality,
                    label: `${m.quality} · ${m.avgStartupMs === null ? "–" : `${fmtNum(m.avgStartupMs)} ms startup`}`,
                    value: m.plays,
                  }))}
                />
              ) : (
                <p className="text-xs text-zinc-500">
                  No delivery telemetry yet.
                </p>
              )}
            </Card>
          </div>

          {d.retention.length > 0 && (
            <Card
              title="Listener retention by first week"
              hint="Share of each week's new listeners who listened again N weeks later."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Cohort</th>
                      <th className="px-2 py-1.5 font-medium">Listeners</th>
                      {Array.from(
                        {
                          length: Math.max(
                            ...d.retention.map((c) => c.weeks.length),
                          ),
                        },
                        (_, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: week columns
                          <th key={i} className="px-2 py-1.5 font-medium">
                            W{i}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {d.retention.map((c) => (
                      <tr key={c.cohort} className="border-t border-white/5">
                        <td className="px-2 py-1.5">{c.cohort}</td>
                        <td className="px-2 py-1.5">{fmtNum(c.size)}</td>
                        {c.weeks.map((w) => (
                          <td
                            key={w.week}
                            className="px-2 py-1.5"
                            style={{
                              background: `rgba(57,135,229,${0.08 + w.rate * 0.6})`,
                            }}
                          >
                            {fmtPct(w.rate)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {!d.lake.available && (
            <Notice>
              Unique listeners, skipped intros and retention come from the S3
              data lake, which isn&apos;t reachable (
              {d.lake.error ?? "not configured"}). Listener counts above fall
              back to listening history.
            </Notice>
          )}
        </>
      )}
    </section>
  );
}
