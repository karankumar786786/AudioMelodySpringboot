"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Stethoscope,
  RefreshCw,
  UploadCloud,
  RotateCcw,
  Search,
  Tag,
  ImageOff,
  AudioWaveform,
  FileText,
  SearchX,
} from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { getImageUrl } from "@/lib/image-utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PaginationBar } from "@/components/PaginationBar";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Toast, ToastType } from "@/components/Toast";

type IssueKey =
  | "missingGenre"
  | "missingCover"
  | "missingAudioFeatures"
  | "missingLyrics"
  | "notIndexed";

interface HealthSong {
  id: string;
  title: string;
  artistName: string;
  album?: string | null;
  genre?: string | null;
  imageKey?: string | null;
  lrclibId?: string | null;
  jobId?: string | null;
  status: string;
  createdAt: string;
  issues: IssueKey[];
}

type HealthSummary = Record<IssueKey, number> & {
  totalSongs: number;
  songsWithIssues: number;
};

interface HealthResponse {
  summary: HealthSummary;
  content: HealthSong[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

interface SkippedItem {
  songId: string;
  reason: string;
}

const ISSUE_META: Record<
  IssueKey,
  {
    label: string;
    short: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: "warning" | "danger" | "indigo" | "purple" | "cyan";
    hint: string;
  }
> = {
  missingGenre: {
    label: "Missing genre",
    short: "Genre",
    icon: Tag,
    variant: "warning",
    hint: "Edit the song in Songs Studio",
  },
  missingCover: {
    label: "Missing cover",
    short: "Cover",
    icon: ImageOff,
    variant: "danger",
    hint: "Edit the song in Songs Studio",
  },
  missingAudioFeatures: {
    label: "No audio features",
    short: "Features",
    icon: AudioWaveform,
    variant: "purple",
    hint: "No linked job has tempo/energy/valence/danceability",
  },
  missingLyrics: {
    label: "No lyrics",
    short: "Lyrics",
    icon: FileText,
    variant: "cyan",
    hint: "No LRCLIB id; set it in Songs Studio",
  },
  notIndexed: {
    label: "Not indexed",
    short: "Index",
    icon: SearchX,
    variant: "indigo",
    hint: "No job recorded both search and recommendation sync; use Re-sync",
  },
};

const ISSUE_KEYS = Object.keys(ISSUE_META) as IssueKey[];

function describeSkipped(skipped: SkippedItem[]): string {
  if (skipped.length === 0) return "";
  const first = skipped[0];
  const more = skipped.length > 1 ? ` (+${skipped.length - 1} more)` : "";
  return ` Skipped ${skipped.length}: ${first.reason}${more}.`;
}

export default function CatalogHealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [issues, setIssues] = useState<IssueKey[]>([]);
  const [match, setMatch] = useState<"any" | "all">("any");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState<"resync" | "reprocess" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Debounce free-text search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
        status: statusFilter,
        match,
      });
      if (issues.length) params.set("issue", issues.join(","));
      if (search) params.set("search", search);
      const res = await adminFetch(`/admin/catalog/health?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog health");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, match, issues, search]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Selection only spans the visible page; clear it when the result set changes.
  useEffect(() => {
    setSelected(new Set());
  }, [page, pageSize, statusFilter, match, issues, search]);

  const rows = useMemo(() => data?.content ?? [], [data]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleIssue = (key: IssueKey) => {
    setIssues((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setPage(0);
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const runAction = async (action: "resync" | "reprocess") => {
    const songIds = Array.from(selected);
    if (songIds.length === 0) return;
    if (
      action === "reprocess" &&
      !confirm(
        `Retry the failed ingestion job for ${songIds.length} song(s)? Songs whose latest job already completed are skipped (they need a new upload via Reprocess audio).`
      )
    ) {
      return;
    }
    setBusyAction(action);
    try {
      const res = await adminFetch(`/admin/catalog/health/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (action === "resync") {
        if (!res.ok && !body?.errors) throw new Error(body?.error || `Re-sync failed (${res.status})`);
        const errs = body.errors ? Object.entries(body.errors).map(([k, v]) => `${k}: ${v}`).join("; ") : "";
        setToast({
          type: errs ? "error" : "success",
          message: errs
            ? `Re-sync partly failed — ${errs}`
            : `Re-synced ${body.algolia ?? 0} to Algolia, ${body.recombee ?? 0} to Recombee.${describeSkipped(body.skipped ?? [])}`,
        });
      } else {
        if (!res.ok) throw new Error(body?.error || `Reprocess failed (${res.status})`);
        setToast({
          type: body.queued?.length ? "success" : "info",
          message: `Queued ${body.queued?.length ?? 0} job(s).${describeSkipped(body.skipped ?? [])}`,
        });
      }
      setSelected(new Set());
      fetchHealth();
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setBusyAction(null);
    }
  };

  const summary = data?.summary;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8 text-white font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Stethoscope className="w-4 h-4" />
            </div>
            Catalog Health
          </h1>
          <p className="text-xs text-zinc-500 mt-1.5">
            Songs missing metadata, audio features, lyrics or search/recommendation indexing.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchHealth()}
          loading={loading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Summary cards (click to filter) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-white/8 bg-[#111114] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Songs with issues</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">
            {summary ? summary.songsWithIssues.toLocaleString() : "—"}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            of {summary ? summary.totalSongs.toLocaleString() : "—"} {statusFilter === "ALL" ? "" : statusFilter.toLowerCase()} songs
          </div>
        </div>
        {ISSUE_KEYS.map((key) => {
          const meta = ISSUE_META[key];
          const Icon = meta.icon;
          const active = issues.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleIssue(key)}
              title={meta.hint}
              aria-pressed={active}
              className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${
                active
                  ? "border-white/30 bg-white/8"
                  : "border-white/8 bg-[#111114] hover:border-white/16 hover:bg-[#16161a]"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums">
                {summary ? summary[key].toLocaleString() : "—"}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{meta.hint}</div>
            </button>
          );
        })}
      </div>

      {/* Filters + bulk actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, artist, album"
              className="h-9 w-64 pl-8 pr-3 rounded-xl bg-[#16161a] border border-white/8 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-white/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="h-9 px-3 rounded-xl bg-[#16161a] border border-white/8 text-xs text-zinc-200 outline-none"
            aria-label="Song status"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ALL">All statuses</option>
          </select>
          {issues.length > 1 && (
            <select
              value={match}
              onChange={(e) => {
                setMatch(e.target.value as "any" | "all");
                setPage(0);
              }}
              className="h-9 px-3 rounded-xl bg-[#16161a] border border-white/8 text-xs text-zinc-200 outline-none"
              aria-label="Issue match mode"
            >
              <option value="any">Any selected issue</option>
              <option value="all">All selected issues</option>
            </select>
          )}
          {issues.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setIssues([]); setPage(0); }}>
              Clear issue filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 tabular-nums">{selected.size} selected</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={selected.size === 0 || busyAction !== null}
            loading={busyAction === "resync"}
            onClick={() => runAction("resync")}
            leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
            title="Push selected active songs to Algolia and Recombee again"
          >
            Re-sync search &amp; recs
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={selected.size === 0 || busyAction !== null}
            loading={busyAction === "reprocess"}
            onClick={() => runAction("reprocess")}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            title="Retry each selected song's latest failed ingestion job"
          >
            Retry failed processing
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/8 bg-[#0d0d0f] overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-sm text-rose-400">{error}</div>
        ) : loading && !data ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm font-semibold text-zinc-200">No songs match these filters</div>
            <div className="text-xs text-zinc-500 mt-1">
              {issues.length || search ? "Try clearing a filter." : "Every song in this view looks healthy."}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/8">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all on this page"
                      className="accent-white cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 font-bold">Song</th>
                  <th className="px-4 py-3 font-bold">Genre</th>
                  <th className="px-4 py-3 font-bold">Issues</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Added</th>
                </tr>
              </thead>
              <tbody className={loading ? "opacity-60 transition-opacity" : ""}>
                {rows.map((song) => {
                  const img = getImageUrl(song.imageKey, { width: 80, height: 80 });
                  const checked = selected.has(song.id);
                  return (
                    <tr
                      key={song.id}
                      onClick={() => toggleRow(song.id)}
                      className={`border-b border-white/5 cursor-pointer transition-colors ${
                        checked ? "bg-white/6" : "hover:bg-white/3"
                      }`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRow(song.id)}
                          aria-label={`Select ${song.title}`}
                          className="accent-white cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-[#1a1a1f] border border-white/8 overflow-hidden shrink-0 flex items-center justify-center">
                            {img ? (
                              <img src={img} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageOff className="w-3.5 h-3.5 text-zinc-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate max-w-[280px]">{song.title}</div>
                            <div className="text-zinc-500 truncate max-w-[280px]">
                              {[song.artistName, song.album].filter(Boolean).join(" • ")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{song.genre || <span className="text-zinc-600">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {song.issues.map((key) => (
                            <Badge key={key} variant={ISSUE_META[key].variant} size="xs" title={ISSUE_META[key].hint}>
                              {ISSUE_META[key].short}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={song.status === "ACTIVE" ? "success" : "neutral"} size="xs">
                          {song.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 tabular-nums whitespace-nowrap">
                        {song.createdAt ? new Date(song.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.totalElements > 0 && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={data.totalElements}
          currentCount={rows.length}
          itemLabel="songs"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          loading={loading}
        />
      )}

      <Toast message={toast?.message ?? null} type={toast?.type} onClose={() => setToast(null)} duration={6000} />
    </div>
  );
}
