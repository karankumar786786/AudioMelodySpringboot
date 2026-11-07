"use client";

import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "success"
    | "indigo"
    | "purple"
    | "cyan"
    | "warning"
    | "danger"
    | "neutral";
  size?: "xs" | "sm" | "md";
  dot?: boolean;
  pulseDot?: boolean;
}

export function Badge({
  className = "",
  variant = "default",
  size = "sm",
  dot = false,
  pulseDot = false,
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    xs: "text-[10px] px-2 py-0.5 gap-1",
    sm: "text-[11px] px-2.5 py-0.5 gap-1.5",
    md: "text-xs px-3 py-1 gap-1.5",
  }[size];

  const variantStyles = {
    default: "bg-white/[0.08] text-zinc-200 border-white/[0.12]",
    neutral: "bg-zinc-800/40 text-zinc-400 border-zinc-700/40",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/25",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/25",
  }[variant];

  const dotColor = {
    default: "bg-zinc-300",
    neutral: "bg-zinc-500",
    success: "bg-emerald-400",
    indigo: "bg-indigo-400",
    purple: "bg-purple-400",
    cyan: "bg-cyan-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border tracking-wide select-none ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${
            pulseDot ? "animate-pulse" : ""
          }`}
        />
      )}
      {children}
    </span>
  );
}

