/** Test: queue logic (lib/queue.ts) ke unit tests - nakli in-memory store ke saath, bina Redis ke. */
import { describe, it, expect, spyOn, afterEach } from "bun:test";
import { blockTimeoutSeconds, handleRawJob, parseJob, buildDlqEntry, retryDelayMs, type MailJob, type MailQueueStore, type DlqEntry } from "../lib/queue";

class MemoryStore implements MailQueueStore {
    ready: string[] = [];
    delayed: { score: number; member: string }[] = [];
    dlq: DlqEntry[] = [];
    async pop() { return this.ready.shift() ?? null; }
    async scheduleRetry(job: MailJob, notBefore: number) {
        this.delayed.push({ score: notBefore, member: JSON.stringify({ ...job, notBefore }) });
    }
    async pushDlq(entry: DlqEntry) { this.dlq.push(entry); }
    async promoteDue(now: number) {
        const due = this.delayed.filter((d) => d.score <= now);
        this.delayed = this.delayed.filter((d) => d.score > now);
        this.ready.push(...due.map((d) => d.member));
        return due.length;
    }
}

const job = (extra: Partial<MailJob> = {}) => JSON.stringify({ to: "a@b.com", subject: "LOGIN", otp: "123456", ...extra });
const failing = async () => { throw Object.assign(new Error("connection reset"), { code: "ECONNRESET" }); };
const neverAuth = () => false;

describe("mail queue handling", () => {
    const spies: { mockRestore(): void }[] = [];
    afterEach(() => spies.splice(0).forEach((s) => s.mockRestore()));

    it("does not log the raw payload of malformed jobs", async () => {
        const errSpy = spyOn(console, "error").mockImplementation(() => {});
        spies.push(errSpy);
        const store = new MemoryStore();
        const raw = '{"to":"a@b.com","otp":"987654"'; // adhoora JSON
        const outcome = await handleRawJob(raw, { send: async () => {}, isAuthError: neverAuth, store });
        expect(outcome.kind).toBe("malformed");
        const logged = errSpy.mock.calls.flat().map(String).join(" ");
        expect(logged).not.toContain("987654");
        expect(logged).not.toContain(raw);
    });

    it("treats JSON missing required fields as malformed", () => {
        expect(parseJob('{"to":"a@b.com"}')).toBeNull();
        expect(parseJob("null")).toBeNull();
        expect(parseJob(job())?.otp).toBe("123456");
    });

    it("schedules a retry with notBefore instead of sleeping, so later mail still flows", async () => {
        spies.push(spyOn(console, "warn").mockImplementation(() => {}));
        const store = new MemoryStore();
        const sent: string[] = [];
        const send = async (to: string) => {
            if (to === "bad@b.com") throw new Error("temporary");
            sent.push(to);
        };
        const now = 1_000_000;
        const started = Date.now();
        const first = await handleRawJob(job({ to: "bad@b.com" }), { send, isAuthError: neverAuth, store, now: () => now });
        const second = await handleRawJob(job({ to: "good@b.com" }), { send, isAuthError: neverAuth, store, now: () => now });

        expect(Date.now() - started).toBeLessThan(1000);
        expect(first).toEqual({ kind: "retry", retries: 1, notBefore: now + retryDelayMs(1) });
        expect(second.kind).toBe("sent");
        expect(sent).toEqual(["good@b.com"]);

        // Abhi time nahi hua
        expect(await store.promoteDue(now + retryDelayMs(1) - 1)).toBe(0);
        // Time ho gaya: retry count ke saath wapas ready queue me
        expect(await store.promoteDue(now + retryDelayMs(1))).toBe(1);
        const requeued = JSON.parse(store.ready[0]!);
        expect(requeued.retries).toBe(1);
        expect(requeued.notBefore).toBe(now + retryDelayMs(1));
    });

    it("moves to the DLQ after MAX_RETRIES without storing the OTP", async () => {
        spies.push(spyOn(console, "error").mockImplementation(() => {}));
        const store = new MemoryStore();
        const outcome = await handleRawJob(job({ retries: 2 }), { send: failing, isAuthError: neverAuth, store, now: () => 0 });
        expect(outcome).toEqual({ kind: "dlq", reason: "max_retries" });
        expect(store.dlq).toHaveLength(1);
        const entry = store.dlq[0]!;
        expect(entry).toEqual({
            to: "a@b.com",
            subject: "LOGIN",
            retries: 3,
            error: "ECONNRESET: connection reset",
            reason: "max_retries",
            failedAt: new Date(0).toISOString(),
        });
        expect(JSON.stringify(store.dlq)).not.toContain("123456");
        expect(store.delayed).toHaveLength(0);
    });

    it("sends auth failures straight to the DLQ without the OTP", async () => {
        const store = new MemoryStore();
        const outcome = await handleRawJob(job(), { send: failing, isAuthError: () => true, store });
        expect(outcome).toEqual({ kind: "dlq", reason: "auth" });
        expect(store.dlq[0]!.reason).toBe("auth");
        expect(JSON.stringify(store.dlq)).not.toContain("123456");
    });

    it("buildDlqEntry truncates long errors", () => {
        const entry = buildDlqEntry({ to: "a", subject: "s", otp: "1" }, new Error("x".repeat(2000)), "max_retries");
        expect(entry.error.length).toBeLessThanOrEqual(501);
        expect("otp" in entry).toBe(false);
    });

    it("backs off exponentially up to 30s", () => {
        expect(retryDelayMs(1)).toBe(5000);
        expect(retryDelayMs(2)).toBe(10000);
        expect(retryDelayMs(5)).toBe(30000);
    });
});

describe("blockTimeoutSeconds", () => {
    it("waits the full idle time when no retry is waiting", () => {
        expect(blockTimeoutSeconds(1_000, null, 55)).toBe(55);
    });
    it("wakes in time for the next due retry", () => {
        expect(blockTimeoutSeconds(0, 7_200, 55)).toBe(8);
    });
    it("never blocks less than 1 s or more than the cap", () => {
        expect(blockTimeoutSeconds(10_000, 5_000, 55)).toBe(1);
        expect(blockTimeoutSeconds(0, 600_000, 55)).toBe(55);
    });
});
