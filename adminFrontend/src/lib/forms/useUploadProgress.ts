"use client";

import { useCallback, useMemo, useState } from "react";
import type { UploadProgressEvent } from "@/lib/upload-utils";

export interface UploadProgressState {
  text: string;
  percent: number | null;
  fileName?: string;
  loadedText?: string;
  speedText?: string;
  retryText: string;
  retrying: boolean;
}

const IDLE: UploadProgressState = { text: "", percent: null, retryText: "", retrying: false };

/** Progress, speed and retry status for a sequence of media uploads. */
export function useUploadProgress() {
  const [state, setState] = useState<UploadProgressState>(IDLE);

  /** Starts a new step; pass `file` for a byte upload, or a percent for a server step. */
  const step = useCallback((text: string, fileOrPercent?: File | number) => {
    setState({
      ...IDLE,
      text,
      percent: typeof fileOrPercent === "number" ? fileOrPercent : fileOrPercent ? 0 : null,
      fileName: fileOrPercent instanceof File ? fileOrPercent.name : undefined,
    });
  }, []);

  const handlers = useMemo(
    () => ({
      onProgress: (p: UploadProgressEvent) =>
        setState((s) => ({
          ...s,
          percent: p.percent,
          loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
          speedText: p.speedText,
        })),
      onRetry: (attempt: number, maxRetries: number, delayMs: number) =>
        setState((s) => ({
          ...s,
          retrying: true,
          retryText: `Network issue detected. Retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt}/${maxRetries})...`,
        })),
    }),
    [],
  );

  const settle = useCallback(() => setState((s) => ({ ...s, retrying: false, retryText: "" })), []);
  const reset = useCallback(() => setState(IDLE), []);

  return { ...state, step, settle, reset, ...handlers };
}

export type UploadProgress = ReturnType<typeof useUploadProgress>;
