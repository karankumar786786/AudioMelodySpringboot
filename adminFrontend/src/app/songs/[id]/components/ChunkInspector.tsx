"use client";

import type Hls from "hls.js";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Square,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtNum, fmtTime, HeatGrid, STATUS } from "@/components/charts/Charts";
import {
  type Check,
  type ChunkResult,
  chunkKbps,
  integrityChecks,
  type MediaPlaylist,
  masterUrl,
  parseMaster,
  parseMedia,
  runPool,
  statsFor,
  timedFetch,
  toCsv,
  type Variant,
} from "@/lib/hls-inspect";
import { Card, Notice } from "./AnalyticsTabs";

type Mode = "one" | "all" | "auto";
const CONCURRENCY = 4;

interface Loaded {
  masterText: string;
  variants: Variant[];
  playlists: Record<string, { text: string; parsed: MediaPlaylist } | null>;
  masterTiming: number;
}

interface SwitchEvent {
  at: number; // ms since start
  from: string | null;
  to: string;
}

function StatusBadge({ status }: { status: Check["status"] }) {
  const map = {
    pass: { Icon: CheckCircle2, color: STATUS.good, label: "Pass" },
    warn: { Icon: AlertTriangle, color: STATUS.warning, label: "Warning" },
    fail: { Icon: XCircle, color: STATUS.critical, label: "Fail" },
  }[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold"
      style={{ color: map.color }}
    >
      <map.Icon className="h-3.5 w-3.5" />
      {map.label}
    </span>
  );
}

export function ChunkInspector({
  songKey,
  duration,
  title,
}: {
  songKey: string;
  duration: number;
  title: string;
}) {
  const src = masterUrl(songKey);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("all");
  const [quality, setQuality] = useState<string>("");
  const [results, setResults] = useState<ChunkResult[]>([]);
  const [switches, setSwitches] = useState<SwitchEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showRaw, setShowRaw] = useState<string | null>(null);
  const [tableQuality, setTableQuality] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const loadManifests = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const t0 = performance.now();
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) throw new Error(`master.m3u8: HTTP ${res.status}`);
      const masterText = await res.text();
      const masterTiming = Math.round(performance.now() - t0);
      const variants = parseMaster(masterText, src);
      if (!variants.length) throw new Error("master.m3u8 lists no renditions");
      const playlists: Loaded["playlists"] = {};
      await Promise.all(
        variants.map(async (v) => {
          try {
            const r = await fetch(v.url, { cache: "no-store" });
            if (!r.ok) throw new Error(String(r.status));
            const text = await r.text();
            playlists[v.label] = { text, parsed: parseMedia(text, v.url) };
          } catch {
            playlists[v.label] = null;
          }
        }),
      );
      setLoaded({ masterText, variants, playlists, masterTiming });
      setQuality((q) => q || variants[variants.length - 1].label);
      setTableQuality((q) => q || variants[variants.length - 1].label);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [src]);

  useEffect(() => {
    loadManifests();
    return () => {
      abortRef.current?.abort();
      hlsRef.current?.destroy();
    };
  }, [loadManifests]);

  const stop = () => {
    abortRef.current?.abort();
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setRunning(false);
  };

  const runFixed = async (variants: Variant[], signal: AbortSignal) => {
    if (!loaded) return;
    const jobs: {
      v: Variant;
      index: number;
      url: string;
      start: number;
      duration: number;
    }[] = [];
    for (const v of variants) {
      const pl = loaded.playlists[v.label]?.parsed;
      if (!pl) continue;
      if (pl.initUrl)
        jobs.push({ v, index: -1, url: pl.initUrl, start: 0, duration: 0 });
      for (const s of pl.segments)
        jobs.push({
          v,
          index: s.index,
          url: s.url,
          start: s.start,
          duration: s.duration,
        });
    }
    setProgress({ done: 0, total: jobs.length });
    let done = 0;
    // One quality at a time, so renditions don't compete for bandwidth.
    for (const v of variants) {
      const mine = jobs.filter((j) => j.v === v);
      await runPool(
        mine,
        CONCURRENCY,
        async (j) => {
          const t = await timedFetch(j.url, signal);
          return {
            ...t,
            quality: v.label,
            index: j.index,
            start: j.start,
            duration: j.duration,
            kbps: j.index >= 0 && t.ok ? chunkKbps(t.bytes, j.duration) : null,
          } satisfies ChunkResult;
        },
        (r) => {
          done += 1;
          setProgress({ done, total: jobs.length });
          setResults((prev) => [...prev, r]);
        },
      );
    }
  };

  const runAuto = async (signal: AbortSignal) => {
    const audio = audioRef.current;
    if (!audio || !loaded) return;
    const { default: HlsLib } = await import("hls.js");
    if (!HlsLib.isSupported())
      throw new Error("hls.js isn't supported in this browser");
    const started = performance.now();
    const total = Math.max(
      1,
      ...Object.values(loaded.playlists).map(
        (p) => p?.parsed.segments.length ?? 0,
      ),
    );
    setProgress({ done: 0, total });
    await new Promise<void>((resolve, reject) => {
      // Buffer the whole track without playing it: ABR still picks the rendition from
      // the measured bandwidth, fragment by fragment.
      const hls = new HlsLib({
        maxBufferLength: duration + 30,
        maxMaxBufferLength: duration + 30,
        backBufferLength: 0,
        startLevel: -1,
        enableWorker: true,
      });
      hlsRef.current = hls;
      let last: string | null = null;
      let done = 0;
      const label = (lvl: number) => {
        const l = hls.levels[lvl];
        return (
          l?.url?.[0]?.match(/(\d+)kbps/)?.[0] ??
          `${Math.round((l?.bitrate || 0) / 1000)}kbps`
        );
      };
      signal.addEventListener("abort", () => {
        hls.destroy();
        resolve();
      });
      hls.on(HlsLib.Events.LEVEL_SWITCHED, (_e, d) => {
        const to = label(d.level);
        setSwitches((s) => [
          ...s,
          { at: Math.round(performance.now() - started), from: last, to },
        ]);
        last = to;
      });
      hls.on(HlsLib.Events.FRAG_LOADED, (_e, d) => {
        const f = d.frag;
        const st = f.stats;
        const isInit = f.sn === "initSegment";
        const bytes = st.loaded || st.total || 0;
        const r: ChunkResult = {
          url: f.url,
          status: 200,
          ok: true,
          bytes,
          ttfbMs: Math.round(st.loading.first - st.loading.start),
          totalMs: Math.round(st.loading.end - st.loading.start),
          quality: label(f.level),
          index: isInit ? -1 : Number(f.sn),
          start: isInit ? 0 : f.start,
          duration: isInit ? 0 : f.duration,
          kbps: isInit ? null : chunkKbps(bytes, f.duration),
        };
        if (!isInit) {
          done += 1;
          setProgress({ done, total });
        }
        setResults((prev) => [...prev, r]);
      });
      hls.on(HlsLib.Events.BUFFER_EOS, () => {
        hls.destroy();
        hlsRef.current = null;
        resolve();
      });
      hls.on(HlsLib.Events.ERROR, (_e, d) => {
        if (d.details === "fragLoadError" || d.details === "fragLoadTimeOut") {
          setResults((prev) => [
            ...prev,
            {
              url: d.frag?.url ?? "",
              status: d.response?.code ?? 0,
              ok: false,
              bytes: 0,
              ttfbMs: 0,
              totalMs: 0,
              quality: d.frag ? label(d.frag.level) : "?",
              index: Number(d.frag?.sn ?? -1),
              start: d.frag?.start ?? 0,
              duration: d.frag?.duration ?? 0,
              kbps: null,
            },
          ]);
        }
        if (d.fatal) {
          hls.destroy();
          reject(new Error(`${d.type}: ${d.details}`));
        }
      });
      hls.loadSource(src);
      hls.attachMedia(audio);
    });
  };

  const run = async () => {
    if (!loaded) return;
    stop();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setResults([]);
    setSwitches([]);
    setRunning(true);
    try {
      if (mode === "auto") await runAuto(ctrl.signal);
      else
        await runFixed(
          mode === "all"
            ? loaded.variants
            : loaded.variants.filter((v) => v.label === quality),
          ctrl.signal,
        );
    } catch (e) {
      if ((e as Error)?.name !== "AbortError")
        setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const qualities = useMemo(() => {
    const order = loaded?.variants.map((v) => v.label) ?? [];
    const seen = new Set(results.map((r) => r.quality));
    return [
      ...order.filter((q) => seen.has(q)),
      ...[...seen].filter((q) => !order.includes(q)),
    ];
  }, [results, loaded]);

  const stats = useMemo(
    () => qualities.map((q) => statsFor(q, results)),
    [qualities, results],
  );
  const checks = useMemo(() => {
    if (!loaded || running) return [];
    const tested =
      mode === "auto"
        ? loaded.variants
        : loaded.variants.filter((v) => qualities.includes(v.label));
    return tested.flatMap((v) =>
      integrityChecks(
        v,
        loaded.playlists[v.label]?.parsed ?? null,
        mode === "auto" ? [] : results,
        duration,
      ),
    );
  }, [loaded, results, qualities, duration, running, mode]);

  const maxChunks = Math.max(
    0,
    ...results.filter((r) => r.index >= 0).map((r) => r.index + 1),
  );
  const cell = useMemo(() => {
    const m = new Map<string, ChunkResult>();
    for (const r of results)
      if (r.index >= 0) m.set(`${r.quality}|${r.index}`, r);
    return m;
  }, [results]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(results)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\w-]+/g, "_")}-chunks-${mode}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tableRows = results.filter(
    (r) => r.quality === (tableQuality || qualities[0]),
  );

  return (
    <div className="space-y-4">
      {/* Hidden element for the Auto (ABR) run; nothing is played. */}
      <audio ref={audioRef} muted preload="none" className="hidden" />

      <Card title="Manifests" hint={src}>
        {loading && (
          <p className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading playlists…
          </p>
        )}
        {loadError && <p className="text-xs text-red-400">{loadError}</p>}
        {loaded && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500">
                <tr>
                  {[
                    "Playlist",
                    "Bandwidth",
                    "Codecs",
                    "Segments",
                    "Target",
                    "Listed length",
                    "Init",
                    "",
                  ].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums text-zinc-300">
                <tr className="border-t border-white/5">
                  <td className="px-2 py-1.5">master.m3u8</td>
                  <td className="px-2 py-1.5" colSpan={5}>
                    {loaded.variants.length} renditions · fetched in{" "}
                    {loaded.masterTiming} ms
                  </td>
                  <td />
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      className="text-zinc-400 hover:text-white"
                      onClick={() =>
                        setShowRaw(showRaw === "master" ? null : "master")
                      }
                    >
                      {showRaw === "master" ? "Hide" : "Raw"}
                    </button>
                  </td>
                </tr>
                {loaded.variants.map((v) => {
                  const pl = loaded.playlists[v.label];
                  const len =
                    pl?.parsed.segments.reduce((a, s) => a + s.duration, 0) ??
                    0;
                  return (
                    <tr key={v.label} className="border-t border-white/5">
                      <td className="px-2 py-1.5">{v.label}</td>
                      <td className="px-2 py-1.5">
                        {v.bandwidth
                          ? `${fmtNum(v.bandwidth / 1000)} kbps`
                          : "–"}
                      </td>
                      <td className="px-2 py-1.5">{v.codecs ?? "–"}</td>
                      <td className="px-2 py-1.5">
                        {pl ? (
                          pl.parsed.segments.length
                        ) : (
                          <span className="text-red-400">failed</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {pl?.parsed.targetDuration
                          ? `${pl.parsed.targetDuration} s`
                          : "–"}
                      </td>
                      <td className="px-2 py-1.5">{pl ? fmtTime(len) : "–"}</td>
                      <td className="px-2 py-1.5">
                        {pl?.parsed.initUrl ? "yes" : "no"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {pl && (
                          <button
                            type="button"
                            className="text-zinc-400 hover:text-white"
                            onClick={() =>
                              setShowRaw(showRaw === v.label ? null : v.label)
                            }
                          >
                            {showRaw === v.label ? "Hide" : "Raw"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {showRaw && (
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-[11px] text-zinc-400">
                {showRaw === "master"
                  ? loaded.masterText
                  : loaded.playlists[showRaw]?.text}
              </pre>
            )}
          </div>
        )}
      </Card>

      <Card
        title="Delivery test"
        hint="Fetches every chunk from your browser with the cache off, 4 at a time per quality. Auto lets hls.js choose renditions as the player would."
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-white/10 p-0.5 text-xs">
            {(
              [
                ["one", "One quality"],
                ["all", "All qualities"],
                ["auto", "Auto (ABR)"],
              ] as const
            ).map(([m, l]) => (
              <button
                type="button"
                aria-pressed={mode === m}
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
          {mode === "one" && loaded && (
            <select
              aria-label="Quality to test"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs text-white"
            >
              {loaded.variants.map((v) => (
                <option key={v.label} value={v.label}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
          {running ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={run}
              disabled={!loaded}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" /> Run test
            </button>
          )}
          {(running || progress.total > 0) && (
            <span className="text-xs tabular-nums text-zinc-400">
              {running && (
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
              )}
              {progress.done} / {progress.total} chunks
            </span>
          )}
          {results.length > 0 && !running && (
            <button
              type="button"
              onClick={exportCsv}
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          )}
        </div>
      </Card>

      {stats.length > 0 && (
        <Card
          title="Latency by quality"
          hint="Over successfully fetched media chunks. Throughput = download speed while fetching."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500">
                <tr>
                  {[
                    "Quality",
                    "Chunks",
                    "Failed",
                    "Size",
                    "TTFB p50",
                    "TTFB p95",
                    "Total p50",
                    "Total p95",
                    "Max",
                    "Avg bitrate",
                    "Throughput",
                  ].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums text-zinc-300">
                {stats.map((s) => (
                  <tr key={s.quality} className="border-t border-white/5">
                    <td className="px-2 py-1.5">{s.quality}</td>
                    <td className="px-2 py-1.5">{s.chunks}</td>
                    <td className="px-2 py-1.5">
                      {s.failed ? (
                        <span className="text-red-400">{s.failed}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {fmtNum(s.bytes / 1024 / 1024, 2)} MB
                    </td>
                    <td className="px-2 py-1.5">{fmtNum(s.ttfbP50)} ms</td>
                    <td className="px-2 py-1.5">{fmtNum(s.ttfbP95)} ms</td>
                    <td className="px-2 py-1.5">{fmtNum(s.totalP50)} ms</td>
                    <td className="px-2 py-1.5">{fmtNum(s.totalP95)} ms</td>
                    <td className="px-2 py-1.5">{fmtNum(s.totalMax)} ms</td>
                    <td className="px-2 py-1.5">
                      {s.avgKbps ? `${s.avgKbps} kbps` : "–"}
                    </td>
                    <td className="px-2 py-1.5">
                      {s.throughputKbps
                        ? s.throughputKbps >= 1000
                          ? `${(s.throughputKbps / 1000).toFixed(1)} Mbps`
                          : `${s.throughputKbps} kbps`
                        : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {maxChunks > 0 && (
        <Card
          title="Chunk latency heatmap"
          hint="Total fetch time per chunk. Brighter = slower. Red = failed; empty = not fetched (Auto fetches one rendition per chunk)."
        >
          <HeatGrid
            label="Fetch time per chunk and quality"
            rows={qualities}
            cols={Array.from({ length: maxChunks }, (_, i) => String(i))}
            colLabelEvery={Math.max(1, Math.ceil(maxChunks / 12))}
            cellHeight={22}
            value={(r, c) => cell.get(`${qualities[r]}|${c}`)?.totalMs ?? null}
            colorFor={(r, c, v, max) => {
              const x = cell.get(`${qualities[r]}|${c}`);
              if (x && !x.ok) return STATUS.critical;
              if (v === null) return "#1f1f23";
              const t = max ? v / max : 0;
              const ramp = [
                "#104281",
                "#1c5cab",
                "#2a78d6",
                "#5598e7",
                "#86b6ef",
                "#b7d3f6",
              ];
              return ramp[
                Math.min(ramp.length - 1, Math.floor(t * ramp.length))
              ];
            }}
            formatCell={(r, c) => {
              const x = cell.get(`${qualities[r]}|${c}`);
              if (!x)
                return (
                  <span>
                    {qualities[r]} · chunk {c}: not fetched
                  </span>
                );
              return (
                <>
                  <div className="font-semibold text-white">
                    {x.quality} · chunk {c} ({fmtTime(x.start)})
                  </div>
                  {x.ok ? (
                    <>
                      <div>
                        TTFB {x.ttfbMs} ms · total {x.totalMs} ms
                      </div>
                      <div className="text-zinc-400">
                        {fmtNum(x.bytes / 1024, 1)} KB · {x.kbps ?? "–"} kbps
                      </div>
                    </>
                  ) : (
                    <div className="text-red-400">
                      Failed ({x.status || "network"})
                    </div>
                  )}
                </>
              );
            }}
          />
        </Card>
      )}

      {switches.length > 0 && (
        <Card
          title="Quality switches (Auto)"
          hint="When the adaptive player changed rendition during the test."
        >
          <ul className="space-y-1 text-xs text-zinc-300">
            {switches.map((s) => (
              <li key={`${s.at}-${s.to}`} className="tabular-nums">
                {(s.at / 1000).toFixed(2)} s:{" "}
                {s.from ? `${s.from} → ` : "started on "}
                {s.to}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {checks.length > 0 && (
        <Card title="Integrity checks">
          <ul className="divide-y divide-white/5 text-xs">
            {checks.map((c) => (
              <li
                key={`${c.quality}-${c.name}`}
                className="flex flex-wrap items-center gap-3 py-1.5"
              >
                <span className="w-16 text-zinc-500">{c.quality}</span>
                <span className="w-32 text-zinc-300">{c.name}</span>
                <StatusBadge status={c.status} />
                <span className="text-zinc-400">{c.detail}</span>
              </li>
            ))}
          </ul>
          {mode === "auto" && (
            <p className="mt-2 text-[11px] text-zinc-500">
              Run “All qualities” to check every chunk of every rendition.
            </p>
          )}
        </Card>
      )}

      {results.length > 0 && (
        <Card title="Chunks">
          {qualities.length > 1 && (
            <div className="mb-2 flex gap-2 text-xs">
              {qualities.map((q) => (
                <button
                  type="button"
                  key={q}
                  onClick={() => setTableQuality(q)}
                  className={`rounded-md px-2.5 py-1 ${q === (tableQuality || qualities[0]) ? "bg-white text-black" : "border border-white/10 text-zinc-400"}`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-96 overflow-auto">
            <table
              className="w-full text-left text-xs"
              data-testid="chunk-table"
            >
              <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                <tr>
                  {[
                    "Chunk",
                    "Start",
                    "Length",
                    "Size",
                    "Bitrate",
                    "TTFB",
                    "Total",
                    "Status",
                  ].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums text-zinc-300">
                {[...tableRows]
                  .sort((a, b) => a.index - b.index)
                  .map((r) => (
                    <tr
                      key={`${r.quality}-${r.index}-${r.url}`}
                      className="border-t border-white/5"
                    >
                      <td className="px-2 py-1">
                        {r.index < 0 ? "init" : r.index}
                      </td>
                      <td className="px-2 py-1">
                        {r.index < 0 ? "–" : fmtTime(r.start)}
                      </td>
                      <td className="px-2 py-1">
                        {r.index < 0 ? "–" : `${r.duration.toFixed(2)} s`}
                      </td>
                      <td className="px-2 py-1">
                        {fmtNum(r.bytes / 1024, 1)} KB
                      </td>
                      <td className="px-2 py-1">
                        {r.kbps ? `${r.kbps} kbps` : "–"}
                      </td>
                      <td className="px-2 py-1">
                        {r.ok ? `${r.ttfbMs} ms` : "–"}
                      </td>
                      <td className="px-2 py-1">
                        {r.ok ? `${r.totalMs} ms` : "–"}
                      </td>
                      <td className="px-2 py-1">
                        {r.ok ? (
                          r.status
                        ) : (
                          <span className="text-red-400">
                            {r.status || "error"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loaded && !loading && !loadError && (
        <Notice>No playlists loaded.</Notice>
      )}
    </div>
  );
}
