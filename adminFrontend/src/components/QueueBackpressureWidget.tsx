"use client";

import React from "react";
import { QueueBackpressureSummary, QueueItem } from "@/lib/api";
import {
  Activity,
  Layers,
  Inbox,
  Mail,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Gauge,
  Sparkles,
  Server,
} from "lucide-react";

interface QueueBackpressureWidgetProps {
  queueData?: QueueBackpressureSummary | null;
  compact?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function QueueBackpressureWidget({
  queueData,
  compact = false,
  onRefresh,
  isRefreshing = false,
}: QueueBackpressureWidgetProps) {
  if (!queueData) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl p-5 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const {
    totalQueued = 0,
    overallStatus = "HEALTHY",
    audioProcessingQueueSize = 0,
    mailQueueSize = 0,
    deleteQueueSize = 0,
    mailDlqSize = 0,
    queues = [],
    timestamp,
  } = queueData;

  const getOverallStatusBadge = () => {
    switch (overallStatus) {
      case "DLQ_ALERT":
        return {
          label: "DLQ Alert: Failed Jobs",
          bg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          dot: "bg-rose-500 animate-ping",
          icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />,
        };
      case "HIGH":
        return {
          label: "High Backpressure (Congested)",
          bg: "bg-red-500/15 text-red-400 border-red-500/30",
          dot: "bg-red-500 animate-ping",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
        };
      case "MODERATE":
        return {
          label: "Elevated Backpressure (Lag)",
          bg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          dot: "bg-amber-500 animate-pulse",
          icon: <Activity className="w-3.5 h-3.5 text-amber-400" />,
        };
      case "HEALTHY":
      default:
        return {
          label: "Workers In-Sync (Optimal)",
          bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          dot: "bg-emerald-400 animate-pulse",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        };
    }
  };

  const getQueueIcon = (queueKey: string, type: string) => {
    if (type === "DLQ") {
      return <AlertOctagon className="w-4 h-4 text-rose-400" />;
    }
    if (queueKey.includes("audio")) {
      return <Gauge className="w-4 h-4 text-indigo-400" />;
    }
    if (queueKey.includes("mail")) {
      return <Mail className="w-4 h-4 text-sky-400" />;
    }
    if (queueKey.includes("delete")) {
      return <Trash2 className="w-4 h-4 text-amber-400" />;
    }
    return <Inbox className="w-4 h-4 text-purple-400" />;
  };

  const getStatusVisuals = (status: string, size: number, isDlq: boolean) => {
    if (isDlq) {
      if (size > 0) {
        return {
          badgeText: `${size} FAILED`,
          badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse",
          barColor: "bg-gradient-to-r from-rose-500 to-red-600",
          percentage: 100,
        };
      }
      return {
        badgeText: "Clean (0)",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        barColor: "bg-emerald-500",
        percentage: 0,
      };
    }

    if (status === "HIGH" || size >= 50) {
      return {
        badgeText: "High Backpressure",
        badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse",
        barColor: "bg-gradient-to-r from-amber-500 to-rose-500",
        percentage: Math.min(100, Math.round((size / 50) * 100)),
      };
    }

    if (status === "ELEVATED" || size >= 10) {
      return {
        badgeText: "Moderate Load",
        badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        barColor: "bg-gradient-to-r from-yellow-500 to-amber-500",
        percentage: Math.min(100, Math.round((size / 50) * 100)),
      };
    }

    return {
      badgeText: "Optimal",
      badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      barColor: "bg-gradient-to-r from-emerald-500 to-teal-400",
      percentage: Math.max(8, Math.min(100, Math.round((size / 10) * 40))),
    };
  };

  const statusBadge = getOverallStatusBadge();

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-white/20">
      {/* Background ambient gradient glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Redis Queue Depths & Backpressure
              </h2>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-slate-400 border border-white/10">
                Live Ingestion Lag
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time worker buffer capacity, lag detection, and dead-letter monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border ${statusBadge.bg} shadow-sm backdrop-blur-md`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${statusBadge.dot}`} />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
            </span>
            {statusBadge.label}
          </div>

          {/* Total Queued counter */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-slate-300">
            <span className="text-slate-400">Queued:</span>
            <span className="font-bold text-white tabular-nums">{totalQueued}</span>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh queue metrics"
            >
              <Activity className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Dead-Letter Alert Callout if mailDlqSize > 0 */}
      {mailDlqSize > 0 && (
        <div className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 relative z-10 animate-in fade-in">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-rose-300">
              {mailDlqSize} Failed Job{mailDlqSize > 1 ? "s" : ""} in Dead-Letter Queue
            </h4>
            <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">
              Email deliveries failed after maximum retry attempts or encountered SMTP provider lockouts (e.g. Gmail 454 rate-limits).
              Inspect worker logs in <code>workers/mailEvents</code> to investigate recipient addresses or authenticate SMTP credentials.
            </p>
          </div>
        </div>
      )}

      {/* Queue Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        {queues.map((q) => {
          const isDlq = q.type === "DLQ";
          const visual = getStatusVisuals(q.backpressureStatus, q.size, isDlq);
          const icon = getQueueIcon(q.queueKey, q.type);

          return (
            <div
              key={q.queueKey}
              className={`rounded-xl border p-4 transition-all duration-200 ${
                isDlq && q.size > 0
                  ? "bg-rose-950/20 border-rose-500/40 hover:border-rose-500/60 shadow-lg shadow-rose-950/30"
                  : "bg-slate-950/40 border-white/5 hover:border-white/15 hover:bg-slate-900/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
                    {icon}
                  </div>
                  <div className="truncate">
                    <h3 className="text-xs font-semibold text-slate-200 truncate" title={q.queueName}>
                      {q.queueName}
                    </h3>
                    <code className="text-[10px] text-slate-500 truncate block font-mono">
                      {q.queueKey}
                    </code>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${visual.badgeClass}`}
                >
                  {visual.badgeText}
                </span>
              </div>

              {/* Metric count */}
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-2xl font-black tracking-tight text-white tabular-nums">
                  {q.size}
                  <span className="text-xs font-normal text-slate-500 ml-1.5">
                    {q.size === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {isDlq ? (
                    <span className={q.size > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                      {q.size > 0 ? "Inspect Logs" : "DLQ Clean"}
                    </span>
                  ) : (
                    <span>Safe: &lt;{q.safeThreshold}</span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-2.5">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${visual.barColor}`}
                  style={{ width: `${visual.percentage}%` }}
                />
              </div>

              {!compact && (
                <p className="text-[11px] text-slate-400 leading-normal line-clamp-2" title={q.description}>
                  {q.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
