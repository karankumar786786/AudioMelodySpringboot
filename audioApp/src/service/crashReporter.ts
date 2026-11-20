import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Minimal crash reporter: sends caught render errors and unhandled JS errors
 * as OpenTelemetry log records (OTLP/HTTP, JSON encoding) to the endpoint in
 * EXPO_PUBLIC_CRASH_REPORT_URL, e.g. "https://collector.example.com/v1/logs".
 *
 * With the variable unset, every function here is a no-op. EXPO_PUBLIC_ values
 * are baked into the app bundle, so never put a secret in the URL.
 */

export type CrashSource = "error-boundary" | "global-handler" | "manual";

export interface CrashReport {
  error: unknown;
  source: CrashSource;
  isFatal?: boolean;
  componentStack?: string | null;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown>;

export interface CrashReporterOptions {
  endpoint?: string | null;
  fetchImpl?: FetchLike;
  /** Most reports sent per app session, so a render loop cannot flood the collector. */
  maxReports?: number;
  /** The same error (type + message) is sent at most once in this window. */
  dedupeWindowMs?: number;
  now?: () => number;
  resource?: Record<string, string>;
}

const SEVERITY_ERROR = 17;
const SEVERITY_FATAL = 21;
const MAX_STACK_CHARS = 8000;

function normalizeError(error: unknown): { type: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { type: error.name || "Error", message: error.message, stack: error.stack };
  }
  if (typeof error === "string") return { type: "Error", message: error };
  try {
    return { type: "NonError", message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { type: "NonError", message: String(error) };
  }
}

const str = (value: string) => ({ stringValue: value });

export function buildOtlpLogPayload(
  report: CrashReport,
  resource: Record<string, string>,
  timeMs: number,
) {
  const { type, message, stack } = normalizeError(report.error);
  const attributes = [
    { key: "exception.type", value: str(type) },
    { key: "exception.message", value: str(message) },
    { key: "crash.source", value: str(report.source) },
    { key: "crash.fatal", value: { boolValue: !!report.isFatal } },
  ];
  if (stack) attributes.push({ key: "exception.stacktrace", value: str(stack.slice(0, MAX_STACK_CHARS)) });
  if (report.componentStack) {
    attributes.push({ key: "react.component_stack", value: str(report.componentStack.slice(0, MAX_STACK_CHARS)) });
  }
  const timeUnixNano = `${Math.floor(timeMs)}000000`;
  return {
    resourceLogs: [
      {
        resource: {
          attributes: Object.entries(resource).map(([key, value]) => ({ key, value: str(value) })),
        },
        scopeLogs: [
          {
            scope: { name: "audioapp.crash-reporter" },
            logRecords: [
              {
                timeUnixNano,
                observedTimeUnixNano: timeUnixNano,
                severityNumber: report.isFatal ? SEVERITY_FATAL : SEVERITY_ERROR,
                severityText: report.isFatal ? "FATAL" : "ERROR",
                body: str(`${type}: ${message}`),
                attributes,
              },
            ],
          },
        ],
      },
    ],
  };
}

function defaultResource(): Record<string, string> {
  return {
    "service.name": "audioapp",
    "service.version": Constants.expoConfig?.version ?? "unknown",
    "os.type": Platform.OS,
    "os.version": String(Platform.Version ?? "unknown"),
    "deployment.environment": __DEV__ ? "development" : "production",
  };
}

export function createCrashReporter(options: CrashReporterOptions = {}) {
  const endpoint = options.endpoint?.trim() || null;
  const fetchImpl: FetchLike | undefined = options.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
  const maxReports = options.maxReports ?? 20;
  const dedupeWindowMs = options.dedupeWindowMs ?? 60_000;
  const now = options.now ?? Date.now;
  const recent = new Map<string, number>();
  let sent = 0;
  let installed = false;

  const isEnabled = () => !!endpoint && !!fetchImpl;

  function report(r: CrashReport): Promise<void> {
    if (!isEnabled() || sent >= maxReports) return Promise.resolve();
    const { type, message } = normalizeError(r.error);
    const key = `${type}:${message}`;
    const t = now();
    const last = recent.get(key);
    if (last !== undefined && t - last < dedupeWindowMs) return Promise.resolve();
    recent.set(key, t);
    sent += 1;

    const body = JSON.stringify(buildOtlpLogPayload(r, options.resource ?? defaultResource(), t));
    // Reporting must never throw or cause another error report.
    return Promise.resolve()
      .then(() => fetchImpl!(endpoint!, { method: "POST", headers: { "Content-Type": "application/json" }, body }))
      .then(
        () => undefined,
        () => undefined,
      );
  }

  /** Chains onto React Native's global JS error handler; safe to call more than once. */
  function installGlobalHandler() {
    if (installed || !isEnabled()) return;
    const errorUtils = (globalThis as { ErrorUtils?: typeof ErrorUtils }).ErrorUtils;
    if (!errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) return;
    installed = true;
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      void report({ error, source: "global-handler", isFatal });
      previous?.(error, isFatal);
    });
  }

  return { isEnabled, report, installGlobalHandler };
}

// Read statically so Expo inlines the value at build time.
export const crashReporter = createCrashReporter({
  endpoint: process.env.EXPO_PUBLIC_CRASH_REPORT_URL,
});
