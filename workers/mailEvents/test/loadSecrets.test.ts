/** Test: load-secrets.ts ke unit tests (secret ids, quoting, exports). */
import { describe, expect, test } from "bun:test";
import { secretIds, shellQuote, toExports } from "../load-secrets";

describe("load-secrets", () => {
  test("splits SECRET_IDS on commas and semicolons", () => {
    expect(secretIds(" onemelody/prod/db, onemelody/prod/redis;onemelody/prod/processing ,")).toEqual([
      "onemelody/prod/db",
      "onemelody/prod/redis",
      "onemelody/prod/processing",
    ]);
    expect(secretIds(undefined)).toEqual([]);
  });

  test("quotes values so the shell takes them literally", () => {
    const tricky = `a'b $HOME \`x\` "q" \\n`;
    const out = Bun.spawnSync(["sh", "-c", `printf %s ${shellQuote(tricky)}`]);
    expect(out.stdout.toString()).toBe(tricky);
  });

  test("turns a JSON object into export lines", () => {
    expect(toExports("s", '{"REDIS_PORT": 6379, "REDIS_SSL_ENABLED": true, "REDIS_HOST": "h"}')).toEqual([
      "export REDIS_PORT='6379'",
      "export REDIS_SSL_ENABLED='true'",
      "export REDIS_HOST='h'",
    ]);
  });

  test("rejects bad secrets without echoing values", () => {
    expect(() => toExports("s", "not json")).toThrow("s: secret is not valid JSON");
    expect(() => toExports("s", '["x"]')).toThrow("JSON object");
    expect(() => toExports("s", '{"BAD-KEY": "x"}')).toThrow("not a valid environment variable name");
    expect(() => toExports("s", '{"K": {"nested": "hidden"}}')).toThrow("K must be a string");
  });
});
