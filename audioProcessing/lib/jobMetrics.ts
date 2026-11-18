import { metrics, type Counter } from "@opentelemetry/api";
import { Middleware } from "inngest";

/**
 * Alerting signals for audio processing jobs (see infra/observability/alerts.yml).
 *
 * - audio_processing.steps: one count per freshly executed Inngest step
 *     attributes: function, step, outcome = success | retry | failure
 *     ("failure" means retries are exhausted; "retry" means Inngest will try again)
 * - audio_processing.runs: one count per finished function run
 *     attributes: function, outcome = success | failure
 *
 * Uses the global MeterProvider registered by lib/otel (no-op in tests).
 */

// Created lazily: the JS metrics API has no proxy meter, so an instrument created
// before lib/otel registers the MeterProvider would stay a no-op forever.
let counters: { steps: Counter; runs: Counter } | undefined;

export function jobCounters() {
  if (!counters) {
    const meter = metrics.getMeter("audio-processing.jobs");
    counters = {
      steps: meter.createCounter("audio_processing.steps", {
        unit: "{step}",
        description: "Inngest step executions by function, step and outcome",
      }),
      runs: meter.createCounter("audio_processing.runs", {
        unit: "{run}",
        description: "Finished Inngest function runs by function and outcome",
      }),
    };
  }
  return counters;
}

type FnLike = { id?: (...args: any[]) => string; opts?: { id?: string } };

export function functionName(fn: unknown): string {
  const f = fn as FnLike;
  try {
    return f?.opts?.id ?? f?.id?.() ?? "unknown";
  } catch {
    return f?.opts?.id ?? "unknown";
  }
}

function stepName(stepInfo: Middleware.OnStepCompleteArgs["stepInfo"]): string {
  return stepInfo?.options?.id ?? String(stepInfo?.stepType ?? "unknown");
}

export class JobMetricsMiddleware extends Middleware.BaseMiddleware {
  readonly id = "job-metrics";

  override onStepComplete(arg: Middleware.OnStepCompleteArgs) {
    if (arg.stepInfo.memoized) return;
    jobCounters().steps.add(1, {
      function: functionName(arg.fn),
      step: stepName(arg.stepInfo),
      outcome: "success",
    });
  }

  override onStepError(arg: Middleware.OnStepErrorArgs) {
    if (arg.stepInfo.memoized) return;
    jobCounters().steps.add(1, {
      function: functionName(arg.fn),
      step: stepName(arg.stepInfo),
      outcome: arg.isFinalAttempt ? "failure" : "retry",
    });
  }

  override onRunComplete(arg: Middleware.OnRunCompleteArgs) {
    jobCounters().runs.add(1, { function: functionName(arg.fn), outcome: "success" });
  }

  override onRunError(arg: Middleware.OnRunErrorArgs) {
    if (!arg.isFinalAttempt) return;
    jobCounters().runs.add(1, { function: functionName(arg.fn), outcome: "failure" });
  }
}
