"use client";

import React from "react";

export type StatusType =
  | "online"
  | "offline"
  | "degraded"
  | "processing"
  | "queued"
  | "completed"
  | "failed";

interface StatusPillProps {
  status: StatusType;
  label?: string;
  size?: "xs" | "sm";
  className?: string;
}

export function StatusPill({
  status,
  label,
  size = "sm",
  className = "",
}: StatusPillProps) {
  const configs: Record<
    StatusType,
    { text: string; bg: string; border: string; dot: string; ping?: boolean }
  > = {
    online: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      dot: "bg-emerald-400",
      ping: true,
    },
    completed: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      dot: "bg-emerald-400",
    },
    processing: {
      text: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
      dot: "bg-indigo-400",
      ping: true,
    },
    queued: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      dot: "bg-amber-400",
    },
    degraded: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      dot: "bg-amber-400",
      ping: true,
    },
    failed: {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      dot: "bg-rose-400",
    },
    offline: {
      text: "text-zinc-400",
      bg: "bg-zinc-800/40",
      border: "border-zinc-700/40",
      dot: "bg-zinc-400",
    },
  };

  const cfg = configs[status] || configs.offline;
  const displayLabel =
    label ||
    status.charAt(0).toUpperCase() + status.slice(1);

  const sizeClass =
    size === "xs"
      ? "text-[10px] px-2 py-0.5 gap-1.5"
      : "text-[11px] px-2.5 py-1 gap-2";

  return (
    <div
      className={`inline-flex items-center rounded-full border font-semibold select-none ${cfg.bg} ${cfg.border} ${cfg.text} ${sizeClass} ${className}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {cfg.ping && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dot}`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`}
        />
      </span>
      <span>{displayLabel}</span>
    </div>
  );
}
