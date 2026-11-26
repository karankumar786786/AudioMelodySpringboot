/**
 * Mail worker ke liye sirf metrics (OpenTelemetry) - alerts ke liye (infra/observability/alerts.yml dekho).
 * Bhejne wale logic (index.ts) se alag rakha hai: worker bas neeche ke record* helpers call karta hai.
 *
 *   mail.sent            counter                 kitne emails provider ne le liye
 *   mail.send_failures   counter {disposition}   fail koshishein: retry | dlq
 *   mail.dlq_pushed      counter {reason}        DLQ me gaye jobs: auth | max_retries
 *   mail.queue_length    gauge   {queue}         main queue aur DLQ ki length (LLEN)
 *
 * OTLP/HTTP se same compose network ke collector ko bhejta hai
 * (OTEL_EXPORTER_OTLP_ENDPOINT, default http://otel-collector:4318). Band karna ho to OTEL_SDK_DISABLED=true.
 */
import { metrics, type Counter } from "@opentelemetry/api";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";

type Instruments = { sent: Counter; failures: Counter; dlq: Counter };

let provider: MeterProvider | undefined;
let instruments: Instruments | undefined;

/** Metrics shuru karo: counters + queue length gauge, har minute export. */
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
          exportIntervalMillis: 60000, // har minute 2 queue lengths Redis se padhta hai (har command ka paisa lagta hai)
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
          // Redis nahi mila: kuch report mat karo (galat 0 se behtar).
        }
      });

    process.once("SIGTERM", () => void provider?.shutdown().catch(() => {}));
    console.log(`[OTEL] Mail worker metrics -> ${url}`);
  } catch (err: any) {
    console.warn("[OTEL WARN] Could not start mail worker metrics:", err?.message || err);
  }
}

/** Ek email bheja gaya (+1). */
export function recordSent() {
  instruments?.sent.add(1);
}

/** Ek fail attempt (+1): retry ya dlq (dlq ka reason bhi). */
export function recordFailure(disposition: "retry" | "dlq", dlqReason?: "auth" | "max_retries") {
  instruments?.failures.add(1, { disposition });
  if (disposition === "dlq") instruments?.dlq.add(1, { reason: dlqReason ?? "unknown" });
}
