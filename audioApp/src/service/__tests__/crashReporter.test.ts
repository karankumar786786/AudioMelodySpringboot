import { buildOtlpLogPayload, createCrashReporter } from "@/service/crashReporter";

const resource = { "service.name": "test" };
const flush = () => new Promise<void>((r) => setImmediate(() => r()));

describe("createCrashReporter", () => {
  it("does nothing when no endpoint is set", async () => {
    const fetchImpl = jest.fn(() => Promise.resolve());
    for (const endpoint of [undefined, null, "", "   "]) {
      const r = createCrashReporter({ endpoint, fetchImpl, resource });
      expect(r.isEnabled()).toBe(false);
      await r.report({ error: new Error("x"), source: "manual" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts an OTLP JSON log to the endpoint", async () => {
    const fetchImpl = jest.fn((_url: string, _init: { body: string }) => Promise.resolve());
    const r = createCrashReporter({ endpoint: "https://otel.test/v1/logs", fetchImpl, resource, now: () => 1000 });
    await r.report({ error: new TypeError("boom"), source: "error-boundary", componentStack: "in App" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://otel.test/v1/logs");
    const record = JSON.parse(init.body).resourceLogs[0].scopeLogs[0].logRecords[0];
    expect(record.body.stringValue).toBe("TypeError: boom");
    expect(record.severityText).toBe("ERROR");
    expect(record.timeUnixNano).toBe("1000000000");
    const attrs = Object.fromEntries(record.attributes.map((a: { key: string; value: object }) => [a.key, a.value]));
    expect(attrs["crash.source"]).toEqual({ stringValue: "error-boundary" });
    expect(attrs["react.component_stack"]).toEqual({ stringValue: "in App" });
    expect(attrs["exception.stacktrace"]).toBeDefined();
  });

  it("dedupes the same error within the window and caps the total", async () => {
    let t = 0;
    const fetchImpl = jest.fn(() => Promise.resolve());
    const r = createCrashReporter({ endpoint: "https://otel.test", fetchImpl, resource, now: () => t, dedupeWindowMs: 100, maxReports: 3 });
    await r.report({ error: new Error("same"), source: "manual" });
    await r.report({ error: new Error("same"), source: "manual" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t = 200;
    await r.report({ error: new Error("same"), source: "manual" });
    await r.report({ error: new Error("other"), source: "manual" });
    await r.report({ error: new Error("third"), source: "manual" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("swallows network failures", async () => {
    const fetchImpl = jest.fn(() => Promise.reject(new Error("offline")));
    const r = createCrashReporter({ endpoint: "https://otel.test", fetchImpl, resource });
    await expect(r.report({ error: "string error", source: "manual" })).resolves.toBeUndefined();
  });

  it("chains onto the existing global handler once", async () => {
    const previous = jest.fn();
    let handler: (e: unknown, fatal?: boolean) => void = previous;
    const g = globalThis as { ErrorUtils?: unknown };
    const original = g.ErrorUtils;
    g.ErrorUtils = { getGlobalHandler: () => handler, setGlobalHandler: jest.fn((h) => (handler = h)) };
    try {
      const fetchImpl = jest.fn((_url: string, _init: { body: string }) => Promise.resolve());
      const r = createCrashReporter({ endpoint: "https://otel.test", fetchImpl, resource });
      r.installGlobalHandler();
      r.installGlobalHandler();
      const err = new Error("fatal");
      handler(err, true);
      await flush();
      expect(previous).toHaveBeenCalledWith(err, true);
      expect(previous).toHaveBeenCalledTimes(1);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const record = JSON.parse(fetchImpl.mock.calls[0][1].body).resourceLogs[0].scopeLogs[0].logRecords[0];
      expect(record.severityText).toBe("FATAL");
    } finally {
      g.ErrorUtils = original;
    }
  });

  it("does not install the handler when disabled", () => {
    const setGlobalHandler = jest.fn();
    const g = globalThis as { ErrorUtils?: unknown };
    const original = g.ErrorUtils;
    g.ErrorUtils = { getGlobalHandler: () => jest.fn(), setGlobalHandler };
    try {
      createCrashReporter({ endpoint: undefined, resource }).installGlobalHandler();
      expect(setGlobalHandler).not.toHaveBeenCalled();
    } finally {
      g.ErrorUtils = original;
    }
  });
});

describe("buildOtlpLogPayload", () => {
  it("handles non-Error values", () => {
    const p = buildOtlpLogPayload({ error: { code: 1 }, source: "manual" }, resource, 0);
    expect(p.resourceLogs[0].scopeLogs[0].logRecords[0].body.stringValue).toBe('NonError: {"code":1}');
    expect(p.resourceLogs[0].resource.attributes).toEqual([{ key: "service.name", value: { stringValue: "test" } }]);
  });
});
