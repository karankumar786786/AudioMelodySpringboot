"use client";

import React from "react";
import { formatMs } from "./jobHelpers";

export interface DurationWaterfallProps {
  elapsedTotalMs?: number | null;
  transcodingDurationMs?: number | null;
  recommendationDurationMs?: number | null;
  searchDurationMs?: number | null;
  finalizeDurationMs?: number | null;
  className?: string;
}

export function DurationWaterfall({
  elapsedTotalMs,
  transcodingDurationMs,
  recommendationDurationMs,
  searchDurationMs,
  finalizeDurationMs,
  className = "",
}: DurationWaterfallProps) {
  const tMs = transcodingDurationMs ?? 0;
  const rMs = recommendationDurationMs ?? 0;
  const sMs = searchDurationMs ?? 0;
  const fMs = finalizeDurationMs ?? 0;

  const stageSum = tMs + rMs + sMs + fMs;
  const total = Math.max(elapsedTotalMs ?? 0, stageSum, 1);

  const tPct = (tMs / total) * 100;
  const rPct = (rMs / total) * 100;
  const sPct = (sMs / total) * 100;
  const fPct = (fMs / total) * 100;

  return (
    <div
      className={`bg-[#141418] border border-white/[0.08] rounded-2xl p-4 space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
        <span>Execution Waterfall &amp; Latency</span>
        <span className="font-mono text-white font-bold">
          Total: {formatMs(elapsedTotalMs)}
        </span>
      </div>

      {/* Stacked Waterfall Bar */}
      <div className="h-2.5 w-full bg-white/[0.05] rounded-full overflow-hidden flex">
        {tPct > 0 && (
          <div
            style={{ width: `${tPct}%` }}
            className="h-full bg-indigo-500 transition-all"
            title={`Transcode: ${formatMs(tMs)} (${tPct.toFixed(0)}%)`}
          />
        )}
        {rPct > 0 && (
          <div
            style={{ width: `${rPct}%` }}
            className="h-full bg-purple-500 transition-all"
            title={`Recombee: ${formatMs(rMs)} (${rPct.toFixed(0)}%)`}
          />
        )}
        {sPct > 0 && (
          <div
            style={{ width: `${sPct}%` }}
            className="h-full bg-cyan-500 transition-all"
            title={`Algolia: ${formatMs(sMs)} (${sPct.toFixed(0)}%)`}
          />
        )}
        {fPct > 0 && (
          <div
            style={{ width: `${fPct}%` }}
            className="h-full bg-emerald-500 transition-all"
            title={`Finalize: ${formatMs(fMs)} (${fPct.toFixed(0)}%)`}
          />
        )}
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
          <span>Transcode:</span>
          <span className="text-zinc-200">{formatMs(tMs)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
          <span>Recombee:</span>
          <span className="text-zinc-200">{formatMs(rMs)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
          <span>Algolia:</span>
          <span className="text-zinc-200">{formatMs(sMs)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>Finalize:</span>
          <span className="text-zinc-200">{formatMs(fMs)}</span>
        </div>
      </div>
    </div>
  );
}
