"use client";

import React from "react";
import {
  UploadCloud,
  Cpu,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { JobStage } from "@/lib/api";
import { formatMs } from "./jobHelpers";

export interface PipelineDagVisualizerProps {
  currentStage: JobStage;
  status: string; // PENDING, PROCESSING, COMPLETED, FAILED
  stageDurations?: {
    transcodingDurationMs?: number | null;
    recommendationDurationMs?: number | null;
    searchDurationMs?: number | null;
    finalizeDurationMs?: number | null;
  };
  className?: string;
}

interface StageStep {
  key: JobStage | "UPLOAD";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGES: StageStep[] = [
  { key: "QUEUED", label: "Upload & Queue", icon: UploadCloud },
  { key: "TRANSCODING", label: "FFmpeg Transcode", icon: Cpu },
  { key: "RECOMMENDATION_INDEXING", label: "Recombee Sync", icon: Sparkles },
  { key: "SEARCH_INDEXING", label: "Algolia Index", icon: Search },
  { key: "FINALIZING", label: "Finalize DB", icon: CheckCircle2 },
];

export function PipelineDagVisualizer({
  currentStage,
  status,
  stageDurations,
  className = "",
}: PipelineDagVisualizerProps) {
  const getStageIndex = (stage: JobStage): number => {
    switch (stage) {
      case "QUEUED":
        return 0;
      case "TRANSCODING":
        return 1;
      case "RECOMMENDATION_INDEXING":
        return 2;
      case "SEARCH_INDEXING":
        return 3;
      case "FINALIZING":
        return 4;
      case "COMPLETED":
        return 5;
      case "FAILED":
        return -1;
      default:
        return 0;
    }
  };

  const currentIndex = getStageIndex(currentStage);
  const isFailed = status === "FAILED" || currentStage === "FAILED";
  const isCompleted = status === "COMPLETED" || currentStage === "COMPLETED";

  const getStepStatus = (index: number) => {
    if (isCompleted) return "completed";
    if (isFailed) {
      if (index < currentIndex) return "completed";
      if (index === currentIndex) return "failed";
      return "upcoming";
    }
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "in_progress";
    return "upcoming";
  };

  const stageDurationMap: Record<number, number | null | undefined> = {
    1: stageDurations?.transcodingDurationMs,
    2: stageDurations?.recommendationDurationMs,
    3: stageDurations?.searchDurationMs,
    4: stageDurations?.finalizeDurationMs,
  };

  return (
    <div
      className={`w-full bg-[#121215] border border-white/[0.08] rounded-2xl p-5 ${className}`}
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Ingestion Pipeline DAG Execution Flow
          </h4>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
          {status}
        </span>
      </div>

      <div className="relative flex items-center justify-between overflow-x-auto no-scrollbar py-2">
        {STAGES.map((step, idx) => {
          const stepStatus = getStepStatus(idx);
          const Icon = step.icon;
          const durationMs = stageDurationMap[idx];

          return (
            <React.Fragment key={step.key}>
              {/* Node Card */}
              <div className="flex flex-col items-center min-w-[110px] z-10">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    stepStatus === "completed"
                      ? "bg-emerald-500/15 border-2 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                      : stepStatus === "in_progress"
                      ? "bg-indigo-500/20 border-2 border-indigo-400 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.4)] animate-pulse"
                      : stepStatus === "failed"
                      ? "bg-rose-500/20 border-2 border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                      : "bg-[#16161a] border border-white/[0.08] text-zinc-600"
                  }`}
                >
                  {stepStatus === "failed" ? (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                <span
                  className={`mt-2 text-[11px] font-semibold text-center whitespace-nowrap ${
                    stepStatus === "completed"
                      ? "text-emerald-400"
                      : stepStatus === "in_progress"
                      ? "text-indigo-300 font-bold"
                      : stepStatus === "failed"
                      ? "text-rose-400 font-bold"
                      : "text-zinc-500"
                  }`}
                >
                  {step.label}
                </span>

                <span className="text-[10px] font-mono text-zinc-400 mt-0.5 tabular-nums">
                  {durationMs ? formatMs(durationMs) : stepStatus === "completed" ? "Done" : "—"}
                </span>
              </div>

              {/* Connecting Pipeline Line */}
              {idx < STAGES.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 bg-white/[0.08] relative min-w-[24px]">
                  {stepStatus === "completed" && (
                    <div className="absolute inset-0 bg-emerald-500" />
                  )}
                  {stepStatus === "in_progress" && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-indigo-500 animate-pulse" />
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
