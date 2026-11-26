/**
 * OpenTelemetry setup: traces, metrics aur logs OTLP/HTTP se collector (ya Uptrace) ko bhejo.
 * Ye file sabse pehle import hoti hai (index.ts), taaki baaki code ke traces bhi pakde jaayein.
 * Start fail ho to sirf warning - service phir bhi chalti hai.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { config } from "dotenv";

config({ quiet: true });

const rawEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector:4318";
const cleanEndpoint = rawEndpoint.replace(/\/+$/, "");

const serviceName = process.env.OTEL_SERVICE_NAME || "audio-processing";
const headers = process.env.UPTRACE_DSN
  ? { "uptrace-dsn": process.env.UPTRACE_DSN }
  : undefined;

/** Endpoint ke aage /v1/traces jaisa path jodo - agar pehle se laga ho to dobara nahi. */
function signalUrl(path: string): string {
  if (cleanEndpoint.endsWith(path)) {
    return cleanEndpoint;
  }
  return `${cleanEndpoint}${path}`;
}

const traceUrl = signalUrl("/v1/traces");
const metricsUrl = signalUrl("/v1/metrics");
const logsUrl = signalUrl("/v1/logs");

const traceExporter = new OTLPTraceExporter({
  url: traceUrl,
  headers,
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({
    url: metricsUrl,
    headers,
  }),
  exportIntervalMillis: 15000, // har 15 second metrics bhejo
});

const logRecordProcessor = new BatchLogRecordProcessor({
  exporter: new OTLPLogExporter({
    url: logsUrl,
    headers,
  }),
});

export const otelSdk = new NodeSDK({
  serviceName,
  traceExporter,
  metricReaders: [metricReader],
  logRecordProcessors: [logRecordProcessor],
});

try {
  otelSdk.start();
  console.log(
    `[OTEL] OpenTelemetry initialized: service="${serviceName}" -> traces:${traceUrl}, metrics:${metricsUrl}, logs:${logsUrl}`
  );
} catch (err: any) {
  console.warn(`[OTEL WARN] Could not start OpenTelemetry SDK:`, err?.message || err);
}

// Container band hote waqt (SIGTERM) bacha hua data bhej ke SDK band karo
process.on("SIGTERM", () => {
  otelSdk
    .shutdown()
    .then(() => console.log("[OTEL] OpenTelemetry SDK terminated cleanly"))
    .catch((err) => console.error("[OTEL] Error shutting down OpenTelemetry SDK", err));
});
