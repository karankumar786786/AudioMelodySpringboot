"use client";

import React, { useState } from "react";
import { DeleteJobProgress } from "@/lib/api";
import {
  X,
  AlertTriangle,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatFailureNotice, formatTime } from "./jobHelpers";

export interface DeleteJobDetailModalProps {
  job: DeleteJobProgress | null;
  onClose: () => void;
  onRetryJob: (jobId: string) => void;
  retryingJobId: string | null;
  onDeleteJob: (jobId: string) => void;
  deletingJobId: string | null;
}

export function DeleteJobDetailModal({
  job,
  onClose,
  onRetryJob,
  retryingJobId,
  onDeleteJob,
  deletingJobId,
}: DeleteJobDetailModalProps) {
  const [showRawDeleteError, setShowRawDeleteError] = useState(false);

  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#282828] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#282828] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                {job.entityTitle || "Untitled Entity"}
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/60 border border-[#282828] text-zinc-300 font-bold">
                  {job.entityType}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Entity ID: {job.entityId} • Task: {job.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Failure Banner with 1-Click Retry */}
          {job.status === "FAILED" && (() => {
            const failure = formatFailureNotice(job.failureReason);
            return (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 space-y-3">
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
                      <p className="text-[11px] text-zinc-400 mt-1">
                        Attempts made: {job.attemptCount} of {job.maxAttempts}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRetryJob(job.id)}
                    disabled={retryingJobId === job.id}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw
                      className={`w-3.5 h-3.5 ${retryingJobId === job.id ? "animate-spin" : ""}`}
                    />
                    Retry Now
                  </button>
                </div>
                {failure.raw && (
                  <div className="pt-2 border-t border-rose-500/10">
                    <button
                      type="button"
                      onClick={() => setShowRawDeleteError(!showRawDeleteError)}
                      className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>{showRawDeleteError ? "Hide" : "View"} technical log</span>
                      {showRawDeleteError ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {showRawDeleteError && (
                      <pre className="mt-2 p-2.5 rounded-lg bg-black/80 border border-[#282828] text-[10px] font-mono text-zinc-400 overflow-x-auto max-h-36 whitespace-pre-wrap leading-tight">
                        {failure.raw}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Stage Progress Timeline */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
              Cascade Teardown Stage Execution
            </h4>

            <div className="space-y-3">
              {job.stages?.map((stage, idx) => {
                const isDone = stage.status === "COMPLETED";
                const isInProgress = stage.status === "IN_PROGRESS";
                const isFailed = stage.status === "FAILED";
                const isSkipped = stage.status === "SKIPPED";

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                      isDone
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : isInProgress
                        ? "bg-rose-500/10 border-rose-500/30 animate-pulse"
                        : isFailed
                        ? "bg-rose-500/10 border-rose-500/30"
                        : isSkipped
                        ? "bg-black/40 border-[#282828] opacity-60"
                        : "bg-black/40 border-[#282828]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          isDone
                            ? "bg-emerald-500 text-white"
                            : isInProgress
                            ? "bg-rose-600 text-white animate-spin"
                            : isFailed
                            ? "bg-rose-500 text-white"
                            : isSkipped
                            ? "bg-zinc-600 text-white"
                            : "bg-black/60 text-zinc-400 border border-[#282828]"
                        }`}
                      >
                        {isDone ? "✓" : isFailed ? "✕" : isSkipped ? "-" : idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          {stage.label}
                          {isSkipped && <span className="text-[10px] text-zinc-500">(Skipped)</span>}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {stage.startedAt ? formatTime(stage.startedAt) : "Pending"}
                          {stage.completedAt && ` → ${formatTime(stage.completedAt)}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-mono font-bold text-xs ${
                          isDone
                            ? "text-emerald-400"
                            : isInProgress
                            ? "text-rose-400"
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

          {/* Media & Key References */}
          <div className="p-4 rounded-2xl bg-black/60 border border-[#282828] space-y-2 text-xs font-mono">
            <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-2">
              Cloud Keys &amp; Resources Purged
            </div>
            {job.songKey && (
              <div className="flex justify-between truncate">
                <span className="text-zinc-500">Audio S3 Prefix:</span>
                <span className="text-zinc-200 font-semibold truncate max-w-[280px]">
                  {job.songKey}
                </span>
              </div>
            )}
            {job.fullVideoKey && (
              <div className="flex justify-between truncate">
                <span className="text-zinc-500">Full Video Prefix:</span>
                <span className="text-indigo-400 font-semibold truncate max-w-[280px]">
                  {job.fullVideoKey}
                </span>
              </div>
            )}
            {job.videoKey && (
              <div className="flex justify-between truncate">
                <span className="text-zinc-500">Video Canvas:</span>
                <span className="text-emerald-400 font-semibold truncate max-w-[280px]">
                  {job.videoKey}
                </span>
              </div>
            )}
            {job.imageKey && (
              <div className="flex justify-between truncate">
                <span className="text-zinc-500">Image Key:</span>
                <span className="text-zinc-200 font-semibold truncate max-w-[280px]">
                  {job.imageKey}
                </span>
              </div>
            )}
            {job.coverImageKey && (
              <div className="flex justify-between truncate">
                <span className="text-zinc-500">Cover Image Key:</span>
                <span className="text-zinc-200 font-semibold truncate max-w-[280px]">
                  {job.coverImageKey}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-[#282828] flex items-center justify-between">
          <button
            onClick={() => onDeleteJob(job.id)}
            disabled={deletingJobId === job.id}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 font-bold text-xs rounded-full transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Audit Record
          </button>
          <div className="flex items-center gap-3">
            {job.status === "FAILED" && (
              <button
                onClick={() => onRetryJob(job.id)}
                disabled={retryingJobId === job.id}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-full transition-all flex items-center gap-2 shadow-lg shadow-rose-900/20 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw
                  className={`w-4 h-4 ${retryingJobId === job.id ? "animate-spin" : ""}`}
                />
                Retry Purge
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-full transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
