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

const traceUrl = cleanEndpoint.endsWith("/v1/traces")
  ? cleanEndpoint
  : `${cleanEndpoint}/v1/traces`;

const metricsUrl = cleanEndpoint.endsWith("/v1/metrics")
  ? cleanEndpoint
  : `${cleanEndpoint}/v1/metrics`;

const logsUrl = cleanEndpoint.endsWith("/v1/logs")
  ? cleanEndpoint
  : `${cleanEndpoint}/v1/logs`;

const traceExporter = new OTLPTraceExporter({
  url: traceUrl,
  headers,
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({
    url: metricsUrl,
    headers,
  }),
  exportIntervalMillis: 15000,
});

const logRecordProcessor = new BatchLogRecordProcessor(
  new OTLPLogExporter({
    url: logsUrl,
    headers,
  })
);

export const otelSdk = new NodeSDK({
  serviceName,
  traceExporter,
  metricReader,
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

process.on("SIGTERM", () => {
  otelSdk
    .shutdown()
    .then(() => console.log("[OTEL] OpenTelemetry SDK terminated cleanly"))
    .catch((err) => console.error("[OTEL] Error shutting down OpenTelemetry SDK", err));
});
