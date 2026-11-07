"use client";

import React, { useState } from "react";
import Image from "next/image";
import { JobProgress } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import {
  X,
  AlertTriangle,
  UploadCloud,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatFailureNotice, formatTime } from "./jobHelpers";
import { PipelineDagVisualizer } from "./PipelineDagVisualizer";
import { DurationWaterfall } from "./DurationWaterfall";

export interface JobDetailModalProps {
  job: JobProgress | null;
  onClose: () => void;
  onRetryJob: (jobId: string) => void;
  retryingJobId: string | null;
  onOpenRecoverModal: (job: JobProgress) => void;
  onDeleteJob: (jobId: string) => void;
  deletingJobId: string | null;
}

export function JobDetailModal({
  job,
  onClose,
  onRetryJob,
  retryingJobId,
  onOpenRecoverModal,
  onDeleteJob,
  deletingJobId,
}: JobDetailModalProps) {
  const [showRawError, setShowRawError] = useState(false);

  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/8 flex items-center justify-between bg-[#0e0e11]">
          <div className="flex items-center gap-4">
            <div className="relative w-13 h-13 rounded-xl overflow-hidden bg-black shrink-0 border border-white/12 shadow-sm">
              {job.imageKey ? (
                <Image
                  src={getImageUrl(job.imageKey, { width: 140, height: 140 })}
                  alt={job.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-500">
                  IMG
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                {job.title}
                {job.isVideoReprocess && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/30">
                    Canvas Reprocess
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400">
                {job.artistName} {job.country ? ` ${job.country}` : ""} • <span className="font-mono text-zinc-500">ID: {job.id}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* Interactive Pipeline Execution DAG Flow */}
          <PipelineDagVisualizer
            currentStage={job.currentStage}
            status={job.status}
            stageDurations={{
              transcodingDurationMs: job.transcodingDurationMs,
              recommendationDurationMs: job.recommendationDurationMs,
              searchDurationMs: job.searchDurationMs,
              finalizeDurationMs: job.finalizeDurationMs,
            }}
          />

          {/* Failure Banner if Failed */}
          {job.status === "FAILED" && (() => {
            const failure = formatFailureNotice(job.failureReason);
            return (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                        {failure.title}
                      </h4>
                      <p className="text-xs mt-1 text-zinc-300 leading-relaxed font-sans">
                        {failure.explanation}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenRecoverModal(job)}
                      className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                      title="Upload fixed audio/video and reprocess job"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload &amp; Fix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRetryJob(job.id)}
                      disabled={retryingJobId === job.id}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw
                        className={`w-3.5 h-3.5 ${
                          retryingJobId === job.id ? "animate-spin" : ""
                        }`}
                      />
                      <span>Retry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteJob(job.id)}
                      disabled={deletingJobId === job.id}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Trash2
                        className={`w-3.5 h-3.5 ${
                          deletingJobId === job.id ? "animate-spin" : ""
                        }`}
                      />
                      <span>Purge</span>
                    </button>
                  </div>
                </div>
                {failure.raw && (
                  <div className="pt-2 border-t border-rose-500/10">
                    <button
                      type="button"
                      onClick={() => setShowRawError(!showRawError)}
                      className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>{showRawError ? "Hide" : "View"} technical log</span>
                      {showRawError ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    {showRawError && (
                      <pre className="mt-2 p-3 rounded-xl bg-black/80 border border-white/8 text-[10px] font-mono text-zinc-300 overflow-x-auto max-h-40 whitespace-pre-wrap leading-tight">
                        {failure.raw}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Duration Waterfall Latency Breakdown */}
          <DurationWaterfall
            elapsedTotalMs={job.elapsedTotalMs}
            transcodingDurationMs={job.transcodingDurationMs}
            recommendationDurationMs={job.recommendationDurationMs}
            searchDurationMs={job.searchDurationMs}
            finalizeDurationMs={job.finalizeDurationMs}
          />

          {/* Stage Progress Timeline */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Webhook Execution &amp; Stage Milestones
            </h4>

            <div className="space-y-2.5">
              {job.stages?.map((stage, idx) => {
                const isDone = stage.status === "COMPLETED";
                const isInProgress = stage.status === "IN_PROGRESS";
                const isFailed = stage.status === "FAILED";
                const isSkipped = stage.status === "SKIPPED";

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                      isDone
                        ? "bg-white/5 border-white/20"
                        : isInProgress
                        ? "bg-indigo-500/10 border-indigo-500/30 animate-pulse"
                        : isFailed
                        ? "bg-rose-500/10 border-rose-500/30"
                        : isSkipped
                        ? "bg-black/40 border-white/6 opacity-60"
                        : "bg-black/40 border-white/6"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                          isDone
                            ? "bg-white text-black"
                            : isInProgress
                            ? "bg-indigo-600 text-white animate-spin"
                            : isFailed
                            ? "bg-rose-500 text-white"
                            : isSkipped
                            ? "bg-zinc-600 text-white"
                            : "bg-black/60 text-zinc-400 border border-white/8"
                        }`}
                      >
                        {isDone ? "✓" : isFailed ? "✕" : isSkipped ? "-" : idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          {stage.label}
                          {isSkipped && (
                            <span className="text-[10px] text-zinc-500 font-mono">
                              (Skipped)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {stage.startedAt ? formatTime(stage.startedAt) : "Pending"}
                          {stage.completedAt && ` → ${formatTime(stage.completedAt)}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-mono font-bold text-xs ${
                          isDone
                            ? "text-zinc-200"
                            : isInProgress
                            ? "text-indigo-400"
                            : "text-zinc-500"
                        }`}
                      >
                        {stage.formattedDuration}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* S3 & Key Media Artifacts */}
          <div className="p-4 rounded-2xl bg-[#0d0d0f] border border-white/8 space-y-2 text-xs font-mono">
            <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-2">
              S3 Media &amp; Index Artifacts
            </div>
            <div className="flex justify-between truncate">
              <span className="text-zinc-500">Song Key:</span>
              <span className="text-zinc-200 font-semibold truncate max-w-85">
                {job.songId ? `audios/${job.songId}` : "-"}
              </span>
            </div>
            {job.videoKey && (
              <div className="flex justify-between truncate">
                <span className="text-zinc-500">Video Canvas:</span>
                <span className="text-zinc-200 font-semibold truncate max-w-85">
                  {job.videoKey}
                </span>
              </div>
            )}
            {job.fullVideoKey && (
              <div className="flex justify-between truncate">
                <span className="text-zinc-500">Full Video:</span>
                <span className="text-indigo-400 font-semibold truncate max-w-85">
                  {job.fullVideoKey}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
