/**
 * Metrics-only OpenTelemetry setup for the mail worker (alerting signals, see
 * infra/observability/alerts.yml). Kept separate from the sending logic in
 * index.ts: the worker only calls the record* helpers below.
 *
 *   mail.sent            counter                 emails accepted by SMTP
 *   mail.send_failures   counter {disposition}   failed attempts: retry | dlq
 *   mail.dlq_pushed      counter {reason}        jobs moved to the DLQ: auth | max_retries
 *   mail.queue_length    gauge   {queue}         LLEN of the main queue and the DLQ
 *
 * Exports via OTLP/HTTP to the collector on the same compose network
 * (OTEL_EXPORTER_OTLP_ENDPOINT, default http://otel-collector:4318).
 * Set OTEL_SDK_DISABLED=true to turn it off.
 */
import { metrics, type Counter } from "@opentelemetry/api";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";

type Instruments = { sent: Counter; failures: Counter; dlq: Counter };

let provider: MeterProvider | undefined;
let instruments: Instruments | undefined;

export function startTelemetry(queueLengths: () => Promise<Record<string, number>>) {
  if (/^(true|1|yes)$/i.test(process.env.OTEL_SDK_DISABLED || "")) return;

  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector:4318").replace(/\/+$/, "");
  const url = endpoint.endsWith("/v1/metrics") ? endpoint : `${endpoint}/v1/metrics`;

  try {
    provider = new MeterProvider({
      resource: resourceFromAttributes({ "service.name": process.env.OTEL_SERVICE_NAME || "mail-worker" }),
      readers: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url }),
          exportIntervalMillis: 60000, // each export reads 2 queue lengths from Redis (billed per command)
        }),
      ],
    });
    metrics.setGlobalMeterProvider(provider);

    const meter = provider.getMeter("mail-worker");
    instruments = {
      sent: meter.createCounter("mail.sent", { unit: "{email}", description: "Emails accepted by SMTP" }),
      failures: meter.createCounter("mail.send_failures", {
        unit: "{attempt}",
        description: "Failed send attempts, by disposition (retry | dlq)",
      }),
      dlq: meter.createCounter("mail.dlq_pushed", {
        unit: "{email}",
        description: "Mail jobs moved to the dead-letter queue, by reason",
      }),
    };

    meter
      .createObservableGauge("mail.queue_length", { unit: "{job}", description: "Redis list length per queue" })
      .addCallback(async (result) => {
        try {
          for (const [queue, length] of Object.entries(await queueLengths())) {
            result.observe(length, { queue });
          }
        } catch {
          // Redis unavailable: report nothing rather than a misleading zero.
        }
      });

    process.once("SIGTERM", () => void provider?.shutdown().catch(() => {}));
    console.log(`[OTEL] Mail worker metrics -> ${url}`);
  } catch (err: any) {
    console.warn("[OTEL WARN] Could not start mail worker metrics:", err?.message || err);
  }
}

export function recordSent() {
  instruments?.sent.add(1);
}

export function recordFailure(disposition: "retry" | "dlq", dlqReason?: "auth" | "max_retries") {
  instruments?.failures.add(1, { disposition });
  if (disposition === "dlq") instruments?.dlq.add(1, { reason: dlqReason ?? "unknown" });
}
