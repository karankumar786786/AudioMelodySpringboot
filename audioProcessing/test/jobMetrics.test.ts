/** JobMetricsMiddleware ke tests: success / retry / failure ki ginti, memoized steps ignore. */
import { describe, expect, it, spyOn, afterEach, mock } from "bun:test";
import { JobMetricsMiddleware, jobCounters, functionName } from "../lib/jobMetrics";

const fn = { opts: { id: "transcode-song" }, id: () => "AudioProcessingApp-transcode-song" } as any;
const step = (memoized = false) => ({ hashedId: "h", memoized, options: { id: "notify-transcoding-started" }, stepType: "run" }) as any;
const mw = new JobMetricsMiddleware({ client: {} as any });

describe("JobMetricsMiddleware", () => {
  afterEach(() => mock.restore());

  it("uses the user-facing function id", () => {
    expect(functionName(fn)).toBe("transcode-song");
  });

  it("counts fresh step success, retry and final failure", () => {
    const add = spyOn(jobCounters().steps, "add");
    mw.onStepComplete({ ctx: {}, fn, output: null, stepInfo: step() } as any);
    mw.onStepError({ ctx: {}, fn, error: new Error("x"), isFinalAttempt: false, stepInfo: step() } as any);
    mw.onStepError({ ctx: {}, fn, error: new Error("x"), isFinalAttempt: true, stepInfo: step() } as any);
    const outcomes = add.mock.calls.map((c) => (c[1] as any).outcome);
    expect(outcomes).toEqual(["success", "retry", "failure"]);
    expect((add.mock.calls[0]![1] as any).step).toBe("notify-transcoding-started");
  });

  it("ignores memoized steps", () => {
    const add = spyOn(jobCounters().steps, "add");
    mw.onStepComplete({ ctx: {}, fn, output: null, stepInfo: step(true) } as any);
    expect(add).not.toHaveBeenCalled();
  });

  it("counts run failure only on the final attempt", () => {
    const add = spyOn(jobCounters().runs, "add");
    mw.onRunError({ ctx: {}, fn, error: new Error("x"), isFinalAttempt: false } as any);
    mw.onRunError({ ctx: {}, fn, error: new Error("x"), isFinalAttempt: true } as any);
    mw.onRunComplete({ ctx: {}, fn, output: null } as any);
    expect(add.mock.calls.map((c) => c[1])).toEqual([
      { function: "transcode-song", outcome: "failure" },
      { function: "transcode-song", outcome: "success" },
    ]);
  });
});
