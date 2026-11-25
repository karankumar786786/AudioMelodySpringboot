"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import {
  BarList,
  fmtNum,
  fmtPct,
  fmtTime,
  HeatGrid,
  HeatStrip,
  Legend,
  LineChart,
  SERIES,
} from "@/components/charts/Charts";
import type { SongAnalytics } from "@/lib/queries/analytics";

export function Card({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/8 bg-zinc-900/40 p-4 ${className}`}
    >
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {hint && <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-white/8 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function Change({
  value,
  inverse = false,
}: {
  value: number | null | undefined;
  inverse?: boolean;
}) {
  if (value === null || value === undefined)
    return <span className="text-zinc-600">no prior data</span>;
  const up = value > 0;
  const good = inverse ? !up : up;
  return (
    <span
      className={
        value === 0
          ? "text-zinc-500"
          : good
            ? "text-emerald-400"
            : "text-red-400"
      }
    >
      {up ? "▲" : value < 0 ? "▼" : "•"} {fmtPct(Math.abs(value))} vs previous
    </span>
  );
}

export function Kpi({
  label,
  value,
  change,
  inverse,
  sub,
}: {
  label: string;
  value: string;
  change?: number | null;
  inverse?: boolean;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-zinc-900/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-white">
        {value}
      </div>
      <div className="mt-0.5 text-[11px]">
        {change !== undefined ? (
          <Change value={change} inverse={inverse} />
        ) : (
          <span className="text-zinc-500">{sub}</span>
        )}
      </div>
    </div>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const shortDay = (d: string | number) => {
  const s = String(d);
  return s.length >= 10 ? s.slice(5) : s;
};

// ---- Overview -------------------------------------------------------------------------

export function OverviewTab({ data }: { data: SongAnalytics }) {
  const { current: k, change } = data.kpis;
  const lake = data.lake;
  const grid = new Map(
    lake.whenListened.map((w) => [`${w.weekday}|${w.hour}`, w.plays]),
  );
  return (
    <div className="space-y-4">
      {k.source === "history" && (
        <Notice>
          Detailed listening events aren&apos;t flowing for this song yet, so
          plays and completion come from listening history. Skips, listening
          time and the heatmap appear once the app sends events (events mode
          DUAL or KAFKA).
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Plays" value={fmtNum(k.plays)} change={change.plays} />
        <Kpi
          label="Listeners"
          value={fmtNum(k.listeners)}
          change={lake.available ? undefined : change.listeners}
          sub={
            k.returningListeners !== undefined
              ? `${fmtNum(k.returningListeners)} returning`
              : undefined
          }
        />
        <Kpi
          label="Qualified streams"
          value={fmtNum(k.qualifiedStreams)}
          change={change.qualifiedStreams}
        />
        <Kpi
          label="Completion rate"
          value={fmtPct(k.completionRate)}
          change={change.completionRate}
        />
        <Kpi
          label="Skip rate"
          value={fmtPct(k.skipRate)}
          sub={
            k.skipRate === null ? "needs events" : `${fmtNum(k.skips)} skips`
          }
        />
        <Kpi
          label="Listening hours"
          value={fmtNum(k.listenedHours, 1)}
          change={change.listenedHours}
        />
        <Kpi
          label="Avg listened"
          value={fmtPct(k.avgListened)}
          sub="of the track per play"
        />
        <Kpi
          label="Plays per listener"
          value={
            k.playsPerListener !== undefined
              ? fmtNum(k.playsPerListener, 2)
              : "–"
          }
          sub="from the data lake"
        />
        <Kpi
          label="Favourites"
          value={fmtNum(data.engagement.favourites)}
          sub="all time"
        />
        <Kpi
          label="Playlist adds"
          value={fmtNum(data.engagement.playlistAdds)}
          sub="user playlists"
        />
        <Kpi
          label="Shorts"
          value={fmtNum(data.engagement.shorts)}
          sub="published with this song"
        />
        <Kpi
          label="Total streams"
          value={fmtNum(data.song.totalStreams)}
          sub="all time (catalog)"
        />
      </div>

      <Card
        title="Plays per day"
        hint="Completions are plays that reached 90% of the track."
      >
        {data.daily.length ? (
          <>
            <Legend
              items={[
                { label: "Plays", color: SERIES[0] },
                { label: "Completions", color: SERIES[1] },
                ...(data.daily.some((d) => d.skips !== null)
                  ? [{ label: "Skips", color: SERIES[2] }]
                  : []),
              ]}
            />
            <LineChart
              ariaLabel="Plays, completions and skips per day"
              x={data.daily.map((d) => d.day)}
              formatX={shortDay}
              series={[
                {
                  key: "plays",
                  label: "Plays",
                  color: SERIES[0],
                  values: data.daily.map((d) => d.plays),
                },
                {
                  key: "completions",
                  label: "Completions",
                  color: SERIES[1],
                  values: data.daily.map((d) => d.completions),
                },
                ...(data.daily.some((d) => d.skips !== null)
                  ? [
                      {
                        key: "skips",
                        label: "Skips",
                        color: SERIES[2],
                        values: data.daily.map((d) => d.skips),
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
        <Card
          title="When people listen"
          hint="Plays by weekday and hour (UTC), from the data lake."
          className="lg:col-span-2"
        >
          {lake.available ? (
            lake.whenListened.length ? (
              <HeatGrid
                label="Plays by weekday and hour"
                rows={WEEKDAYS}
                cols={Array.from({ length: 24 }, (_, h) => String(h))}
                colLabelEvery={3}
                value={(r, c) => grid.get(`${r}|${c}`) ?? 0}
                formatCell={(r, c) => (
                  <>
                    <div className="font-semibold text-white">
                      {WEEKDAYS[r]} {String(c).padStart(2, "0")}:00
                    </div>
                    {fmtNum(grid.get(`${r}|${c}`) ?? 0)} plays
                  </>
                )}
              />
            ) : (
              <p className="text-xs text-zinc-500">
                No plays in the lake for this range.
              </p>
            )
          ) : (
            <Notice>
              The data lake isn&apos;t available (
              {lake.error ?? "not configured"}).
            </Notice>
          )}
        </Card>
        <Card title="Platforms" hint="Plays and average share listened.">
          {lake.platforms.length ? (
            <BarList
              items={lake.platforms.map((p) => ({
                key: p.platform,
                label: `${p.platform} · ${fmtPct(p.avgListened)} listened`,
                value: p.plays,
              }))}
            />
          ) : (
            <p className="text-xs text-zinc-500">
              {lake.available
                ? "No platform data yet."
                : "Needs the data lake."}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---- Listening heatmap -------------------------------------------------------------------

export function HeatmapTab({
  data,
  onSeek,
  playhead,
}: {
  data: SongAnalytics;
  onSeek: (sec: number) => void;
  playhead: number | null;
}) {
  const t = data.timeline;
  if (!t.seconds.length) {
    return (
      <Notice>
        No per-second listening data yet. It builds up from plays sent by app
        versions with listening detail, through the streams{" "}
        <code>analytics</code> profile. Covers all time, not the selected range.
      </Notice>
    );
  }
  const s = t.seconds;
  const total = s.reduce((a, x) => a + x.exits, 0);
  // Drop-off as a share of tracked plays, per 5 s bucket.
  const buckets: {
    start: number;
    exits: number;
    skips: number;
    seeksAway: number;
    seeksInto: number;
  }[] = [];
  for (let i = 0; i < s.length; i += 5) {
    const part = s.slice(i, i + 5);
    buckets.push({
      start: i,
      exits: part.reduce((a, x) => a + x.exits, 0),
      skips: part.reduce((a, x) => a + x.skips, 0),
      seeksAway: part.reduce((a, x) => a + x.seeksAway, 0),
      seeksInto: part.reduce((a, x) => a + x.seeksInto, 0),
    });
  }
  const topExits = [...buckets]
    .sort((a, b) => b.exits - a.exits)
    .slice(0, 5)
    .filter((b) => b.exits > 0);
  const topSeekTargets = [...buckets]
    .sort((a, b) => b.seeksInto - a.seeksInto)
    .slice(0, 5)
    .filter((b) => b.seeksInto > 0);
  const sum = t.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi
          label="Tracked plays"
          value={fmtNum(sum?.trackedPlays)}
          sub="with listening detail"
        />
        <Kpi
          label="Most played moment"
          value={
            sum?.peakSec !== null && sum?.peakSec !== undefined
              ? fmtTime(sum.peakSec)
              : "–"
          }
          sub="peak of the heatmap"
        />
        <Kpi
          label="Left in first 30 s"
          value={fmtPct(sum?.earlyExitRate)}
          sub="of all drop-offs"
        />
        <Kpi
          label="Skips"
          value={fmtNum(sum?.totalSkips)}
          sub="skip button, all time"
        />
        <Kpi
          label="Seeks"
          value={fmtNum(sum?.totalSeeks)}
          sub="scrubs during plays"
        />
      </div>

      <Card
        title="Listening heatmap"
        hint="How many plays covered each second. Brighter = played more. Outlined: the song's hooks (where listeners come back). Click to play from that point."
      >
        <HeatStrip
          label="Listens per second of the song"
          values={s.map((x) => x.listens)}
          highlights={t.hooks.map((h) => ({
            start: h.startSec,
            end: h.endSec,
          }))}
          playhead={playhead === null ? null : Math.floor(playhead)}
          onPick={onSeek}
          formatCell={(i) => (
            <>
              <div className="font-semibold text-white">{fmtTime(i)}</div>
              <div>
                {fmtNum(s[i].listens)} listens · {fmtPct(s[i].retention)}{" "}
                retained
              </div>
              <div className="text-zinc-400">
                {s[i].exits} left · {s[i].skips} skipped · {s[i].seeksInto}{" "}
                seeked here
              </div>
            </>
          )}
        />
        <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
          <span>0:00</span>
          <span>{fmtTime(s.length)}</span>
        </div>
        {t.hooks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {t.hooks.map((h, i) => (
              <button
                type="button"
                key={h.startSec}
                onClick={() => onSeek(h.startSec)}
                className="rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1 text-zinc-300 hover:border-white/30"
              >
                Hook {i + 1}: {fmtTime(h.startSec)}–{fmtTime(h.endSec)}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Retention"
        hint="Share of plays still listening at each second (100% = everyone who started). Rises mean replays or seeks into that part. Click to play from there."
      >
        <LineChart
          ariaLabel="Share of plays still listening by second"
          x={s.map((x) => x.sec)}
          formatX={(v) => fmtTime(Number(v))}
          formatY={(v) => fmtPct(v)}
          yMax={Math.max(1, ...s.map((x) => x.retention))}
          series={[
            {
              key: "retention",
              label: "Still listening",
              color: SERIES[0],
              values: s.map((x) => x.retention),
            },
          ]}
          markers={t.hooks.map((h) => ({ index: h.startSec, label: "hook" }))}
          onPick={onSeek}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="Where people leave"
          hint="5-second windows with the most drop-offs (including skips)."
        >
          {topExits.length ? (
            <BarList
              color={SERIES[1]}
              items={topExits.map((b) => ({
                key: String(b.start),
                label: `${fmtTime(b.start)}–${fmtTime(b.start + 5)} · ${b.skips} skips`,
                value: b.exits,
              }))}
              format={(v) => `${fmtNum(v)} (${fmtPct(total ? v / total : 0)})`}
            />
          ) : (
            <p className="text-xs text-zinc-500">No drop-offs recorded.</p>
          )}
        </Card>
        <Card
          title="Where people seek to"
          hint="5-second windows listeners jump into most."
        >
          {topSeekTargets.length ? (
            <BarList
              color={SERIES[2]}
              items={topSeekTargets.map((b) => ({
                key: String(b.start),
                label: `${fmtTime(b.start)}–${fmtTime(b.start + 5)}`,
                value: b.seeksInto,
              }))}
            />
          ) : (
            <p className="text-xs text-zinc-500">No seeks recorded.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---- Delivery & quality ------------------------------------------------------------------

export function QualityTab({ data }: { data: SongAnalytics }) {
  const rows = data.quality;
  if (!rows.length) {
    return (
      <Notice>
        No delivery telemetry for this range yet. Startup time and stalls come
        from app versions that send listening detail. Use the chunk inspector to
        test delivery now.
      </Notice>
    );
  }
  const byQuality = new Map<
    string,
    { plays: number; startupW: number; startupN: number; rb: number }
  >();
  for (const r of rows) {
    const q = byQuality.get(r.quality) ?? {
      plays: 0,
      startupW: 0,
      startupN: 0,
      rb: 0,
    };
    q.plays += r.plays;
    if (r.avgStartupMs !== null) {
      q.startupW += r.avgStartupMs * r.plays;
      q.startupN += r.plays;
    }
    q.rb += r.rebuffersPerPlay * r.plays;
    byQuality.set(r.quality, q);
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="Plays by quality"
          hint="Auto = adaptive (the player picks the rendition)."
        >
          <BarList
            items={[...byQuality.entries()].map(([q, v]) => ({
              key: q,
              label: q,
              value: v.plays,
            }))}
          />
        </Card>
        <Card
          title="Average startup by quality"
          hint="From play request to audio, in milliseconds."
        >
          <BarList
            color={SERIES[1]}
            items={[...byQuality.entries()]
              .filter(([, v]) => v.startupN > 0)
              .map(([q, v]) => ({
                key: q,
                label: q,
                value: Math.round(v.startupW / v.startupN),
              }))}
            format={(v) => `${fmtNum(v)} ms`}
          />
        </Card>
      </div>
      <Card title="Delivery by quality and platform">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                {[
                  "Quality",
                  "Platform",
                  "Plays",
                  "Listening h",
                  "Avg startup",
                  "Stalls / play",
                  "Stall ms / play",
                  "Time stalled",
                ].map((h) => (
                  <th key={h} className="px-2 py-1.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-zinc-300">
              {rows.map((r) => (
                <tr
                  key={`${r.quality}-${r.platform}`}
                  className="border-t border-white/5"
                >
                  <td className="px-2 py-1.5">{r.quality}</td>
                  <td className="px-2 py-1.5">{r.platform}</td>
                  <td className="px-2 py-1.5">{fmtNum(r.plays)}</td>
                  <td className="px-2 py-1.5">{fmtNum(r.listenedHours, 1)}</td>
                  <td className="px-2 py-1.5">
                    {r.avgStartupMs === null
                      ? "–"
                      : `${fmtNum(r.avgStartupMs)} ms`}
                  </td>
                  <td className="px-2 py-1.5">
                    {fmtNum(r.rebuffersPerPlay, 2)}
                  </td>
                  <td className="px-2 py-1.5">{fmtNum(r.rebufferMsPerPlay)}</td>
                  <td className="px-2 py-1.5">{fmtPct(r.stallRatio, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
