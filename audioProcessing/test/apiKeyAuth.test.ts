import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { requireApiKey, isValidApiKey, getConfiguredApiKey } from "../lib/apiKeyAuth";

type MockRes = { statusCode?: number; body?: any; status: (c: number) => MockRes; json: (b: any) => MockRes };

function run(headers: Record<string, string>) {
  const req: any = {
    ip: "127.0.0.1",
    method: "POST",
    originalUrl: "/api/jobs/1/cancel",
    header: (name: string) => headers[name.toLowerCase()],
  };
  const res: MockRes = {
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  let nextCalled = false;
  requireApiKey(req, res as any, () => { nextCalled = true; });
  return { res, nextCalled };
}

const saved = { ...process.env };

describe("requireApiKey", () => {
  beforeEach(() => {
    delete process.env.AUDIO_PROCESSING_API_KEY;
    delete process.env.APPLICATION_API_KEY;
  });
  afterEach(() => {
    process.env.AUDIO_PROCESSING_API_KEY = saved.AUDIO_PROCESSING_API_KEY;
    process.env.APPLICATION_API_KEY = saved.APPLICATION_API_KEY;
    if (saved.AUDIO_PROCESSING_API_KEY === undefined) delete process.env.AUDIO_PROCESSING_API_KEY;
    if (saved.APPLICATION_API_KEY === undefined) delete process.env.APPLICATION_API_KEY;
  });

  it("fails closed with 503 when no key is configured", () => {
    const { res, nextCalled } = run({ "x-api-key": "anything" });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(503);
  });

  it("rejects a missing header with 401", () => {
    process.env.AUDIO_PROCESSING_API_KEY = "secret-key";
    const { res, nextCalled } = run({});
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("rejects a wrong key with 401", () => {
    process.env.AUDIO_PROCESSING_API_KEY = "secret-key";
    const { res, nextCalled } = run({ "x-api-key": "secret-kez" });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("accepts the correct key", () => {
    process.env.AUDIO_PROCESSING_API_KEY = "secret-key";
    const { res, nextCalled } = run({ "x-api-key": "secret-key" });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBeUndefined();
  });

  it("falls back to APPLICATION_API_KEY", () => {
    process.env.APPLICATION_API_KEY = "app-key";
    expect(getConfiguredApiKey()).toBe("app-key");
    expect(run({ "x-api-key": "app-key" }).nextCalled).toBe(true);
  });

  it("isValidApiKey handles length mismatch and multibyte input", () => {
    expect(isValidApiKey("short", "longer-key")).toBe(false);
    expect(isValidApiKey(undefined, "k")).toBe(false);
    expect(isValidApiKey("é", "ab")).toBe(false);
  });
});
