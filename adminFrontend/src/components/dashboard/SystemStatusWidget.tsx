"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Cpu, Server, HardDrive, Zap, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { QueueBackpressureSummary, SystemHealthTelemetry, adminClient } from "@/lib/api";

interface SystemStatusWidgetProps {
  queueStats?: QueueBackpressureSummary;
  systemHealth?: SystemHealthTelemetry;
}

export function SystemStatusWidget({
  queueStats,
  systemHealth: initialSystemHealth,
}: SystemStatusWidgetProps) {
  const [telemetry, setTelemetry] = useState<SystemHealthTelemetry | undefined>(
    initialSystemHealth
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (initialSystemHealth) {
      setTelemetry(initialSystemHealth);
    }
  }, [initialSystemHealth]);

  const refreshHealth = async () => {
    try {
      setIsRefreshing(true);
      const data = await adminClient.system.getHealth();
      setTelemetry(data);
    } catch (err) {
      console.warn("Failed to refresh live system health", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const adminStatus = telemetry?.adminBackend?.status || "UP";
  const audioStatus = telemetry?.audioProcessing?.status || "UP";
  const cpuPercent = Math.min(100, Math.max(0, telemetry?.audioProcessing?.cpuUtilization ?? 0));
  const activeJobs = telemetry?.audioProcessing?.activeJobs ?? 0;
  const concurrencyLimit = telemetry?.audioProcessing?.concurrencyLimit ?? 2;
  const memoryUsed = telemetry?.audioProcessing?.memoryUsedMb;
  const isHealthy = adminStatus === "UP" && audioStatus === "UP";

  const getCpuColorClasses = (pct: number) => {
    if (pct >= 80) {
      return {
        bar: "bg-gradient-to-r from-rose-500 to-red-600",
        text: "text-rose-400",
        badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      };
    }
    if (pct >= 50) {
      return {
        bar: "bg-gradient-to-r from-amber-500 to-orange-500",
        text: "text-amber-400",
        badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      };
    }
    return {
      bar: "bg-gradient-to-r from-emerald-500 to-teal-400",
      text: "text-emerald-400",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  };

  const cpuStyles = getCpuColorClasses(cpuPercent);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UP":
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        );
      case "DEGRADED":
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Degraded
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Offline
          </span>
        );
    }
  };

  const getQueuePulseColor = () => {
    switch (queueStats?.overallStatus) {
      case "DLQ_ALERT":
        return "bg-rose-500 animate-ping";
      case "HIGH":
        return "bg-red-500 animate-ping";
      case "MODERATE":
        return "bg-amber-500 animate-pulse";
      default:
        return "bg-emerald-500";
    }
  };

  const getQueueBadgeStyle = () => {
    switch (queueStats?.overallStatus) {
      case "DLQ_ALERT":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "HIGH":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "MODERATE":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
  };

  return (
    <div className="bg-[#121212] rounded-2xl border border-[#282828] p-6 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">System Telemetry</h2>
          </div>
          <button
            onClick={refreshHealth}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Refresh system telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-zinc-400 mb-5">Bidirectional health & CPU monitor</p>

        <div className="space-y-3">
          {/* Admin Backend Node */}
          <div className="p-3.5 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-200">Admin Backend</span>
              </div>
              {getStatusBadge(adminStatus)}
            </div>
            <div className="flex items-center gap-4 text-[11px] text-zinc-400 pt-1 border-t border-[#222]">
              <span className="flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    telemetry?.adminBackend?.dbConnected !== false ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                PostgreSQL DB
              </span>
              <span className="flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    telemetry?.adminBackend?.redisConnected !== false ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                Redis Cache
              </span>
            </div>
          </div>

          {/* Audio Processing Worker Node */}
          <div className="p-3.5 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-zinc-200">Audio Processing</span>
              </div>
              {getStatusBadge(audioStatus)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-[#222]">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-zinc-500" />
                Inngest Direct Dispatch
              </span>
              <span>
                {telemetry?.audioProcessing?.latencyMs
                  ? `${telemetry.audioProcessing.latencyMs}ms probe`
                  : "Live heartbeat"}
              </span>
            </div>
          </div>

          {/* Audio Processing CPU Utilization Meter */}
          <div className="p-3.5 rounded-xl bg-black/50 border border-[#282828] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-zinc-200">Worker CPU Usage</span>
              </div>
              <span className={`text-xs font-mono font-bold ${cpuStyles.text}`}>
                {cpuPercent.toFixed(1)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-zinc-800/80 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${cpuStyles.bar}`}
                style={{ width: `${Math.max(3, cpuPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>
                Slots: <span className="text-zinc-200 font-semibold">{activeJobs}</span> / {concurrencyLimit} active
              </span>
              <span>
                {memoryUsed ? `RAM: ${memoryUsed} MB` : "Normal Load"}
              </span>
            </div>
          </div>

          {/* Queue Buffer & Ingestion */}
          <Link
            href="/jobs"
            className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${getQueuePulseColor()}`} />
              <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                Queue Buffer ({queueStats?.totalQueued ?? 0})
              </span>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getQueueBadgeStyle()}`}>
              {queueStats?.overallStatus || "Optimal"}
            </span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 mt-6 border-t border-[#282828] text-xs text-zinc-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? "bg-emerald-400" : "bg-amber-400"}`} />
          {isHealthy ? "Telemetry synced" : "Reviewing nodes"}
        </span>
        <span className="font-mono text-[11px]">Port 8000 & 5010</span>
      </div>
    </div>
  );
}
