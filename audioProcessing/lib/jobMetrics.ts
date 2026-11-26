/** Inngest jobs ke metrics (counters) - alerts ke liye. Neeche detail. */
import { metrics, type Counter } from "@opentelemetry/api";
import { Middleware } from "inngest";

/**
 * Audio processing jobs ke alerting metrics (dekho infra/observability/alerts.yml).
 *
 * - audio_processing.steps: har naye chale Inngest step ki ek ginti
 *     attributes: function, step, outcome = success | retry | failure
 *     ("failure" = saare retries khatam; "retry" = Inngest dobara try karega)
 * - audio_processing.runs: har khatam hue function run ki ek ginti
 *     attributes: function, outcome = success | failure
 *
 * lib/otel ka global MeterProvider use hota hai (tests me ye kuch nahi karta).
 */

// Der se (lazily) banate hain: JS metrics API me proxy meter nahi hota, isliye agar counter
// lib/otel ke MeterProvider register karne se pehle ban gaya to hamesha ke liye no-op reh jaata.
let counters: { steps: Counter; runs: Counter } | undefined;

/** Dono counters lautao; pehli baar call par banao (upar wali wajah se). */
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

/** Inngest function ka id nikalo (naye / purane dono SDK shapes). Na mile to "unknown". */
export function functionName(fn: unknown): string {
  const f = fn as FnLike;
  try {
    return f?.opts?.id ?? f?.id?.() ?? "unknown";
  } catch {
    return f?.opts?.id ?? "unknown";
  }
}

/** Step ka id, warna step ka type, warna "unknown". */
function stepName(stepInfo: Middleware.OnStepCompleteArgs["stepInfo"]): string {
  return stepInfo?.options?.id ?? String(stepInfo?.stepType ?? "unknown");
}

/**
 * Inngest middleware: har step / run khatam hone par upar ke counters badhata hai.
 * memoized step = pehle hi chal chuka, Inngest bas result dobara de raha hai - use nahi ginte.
 */
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
    // Sirf aakhri attempt ki failure gino - beech ke retries "failure" nahi hain
    if (!arg.isFinalAttempt) return;
    jobCounters().runs.add(1, { function: functionName(arg.fn), outcome: "failure" });
  }
}
