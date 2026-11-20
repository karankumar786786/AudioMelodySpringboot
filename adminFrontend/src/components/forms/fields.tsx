"use client";

import type { ReactNode } from "react";
import type { FieldError } from "react-hook-form";

export const labelCls =
  "block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5";
export const inputCls =
  "w-full bg-black/60 border border-[#282828] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-all aria-[invalid=true]:border-rose-500/60";
export const fileCls =
  "w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-[#282828] file:text-xs file:font-semibold file:bg-black/60 file:text-zinc-200 hover:file:bg-white hover:file:text-black file:transition-all cursor-pointer";
export const timeInputCls =
  "w-full bg-black/60 border border-[#282828] rounded-xl px-2.5 py-1.5 text-xs font-mono text-center font-bold text-white focus:outline-none focus:border-zinc-400 aria-[invalid=true]:border-rose-500/60";

export function FieldErrorText({
  error,
  id,
}: {
  error?: FieldError | { message?: string };
  id?: string;
}) {
  if (!error?.message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-[11px] text-rose-400">
      {error.message}
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  children,
  className = "",
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: FieldError | { message?: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
      </label>
      {children}
      <FieldErrorText
        error={error}
        id={htmlFor ? `${htmlFor}-error` : undefined}
      />
    </div>
  );
}
