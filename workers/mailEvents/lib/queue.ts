import type { Redis } from "ioredis";

export interface MailJob {
    to: string;
    subject: string;
    otp: string;
    retries?: number;
    /** Epoch ms before which a retried job must not be sent. */
    notBefore?: number;
    /** Makes each delayed entry unique inside the sorted set. */
    retryId?: string;
}

/** What is kept in the DLQ: everything needed to triage, never the OTP. */
export interface DlqEntry {
    to: string;
    subject: string;
    retries: number;
    error: string;
    reason: "auth" | "max_retries";
    failedAt: string;
}

export interface MailQueueStore {
    /** Blocking pop of the next ready job; resolves null on timeout. */
    pop(timeoutSeconds: number): Promise<string | null>;
    /** Schedule a job for retry no earlier than `notBefore` without blocking other mail. */
    scheduleRetry(job: MailJob, notBefore: number): Promise<void>;
    pushDlq(entry: DlqEntry): Promise<void>;
    /** Move delayed jobs whose time has come back onto the ready queue. Returns how many moved. */
    promoteDue(now: number): Promise<number>;
}

export type SendFn = (to: string, subject: string, body: string) => Promise<unknown>;

export const MAX_RETRIES = 3;
const MAX_ERROR_LENGTH = 500;

export function retryDelayMs(retries: number): number {
    return Math.min(5000 * Math.pow(2, retries - 1), 30000);
}

export function parseJob(raw: string): MailJob | null {
    try {
        const data = JSON.parse(raw);
        if (
            !data ||
            typeof data !== "object" ||
            typeof data.to !== "string" ||
            typeof data.subject !== "string" ||
            typeof data.otp !== "string"
        ) {
            return null;
        }
        return data as MailJob;
    } catch {
        return null;
    }
}

export function errorSummary(error: any): string {
    const code = error?.code || error?.responseCode || error?.name;
    const message = typeof error?.message === "string" ? error.message : String(error);
    const text = code ? `${code}: ${message}` : message;
    return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH)}…` : text;
}

export function buildDlqEntry(job: MailJob, error: unknown, reason: DlqEntry["reason"], now = Date.now()): DlqEntry {
    return {
        to: job.to,
        subject: job.subject,
        retries: job.retries || 0,
        error: errorSummary(error),
        reason,
        failedAt: new Date(now).toISOString(),
    };
}

export type JobOutcome =
    | { kind: "sent" }
    | { kind: "malformed" }
    | { kind: "retry"; retries: number; notBefore: number }
    | { kind: "dlq"; reason: DlqEntry["reason"] };

/**
 * Process one raw queue entry. Never sleeps: failed sends are scheduled on the
 * delayed set so the rest of the queue keeps flowing.
 */
export async function handleRawJob(
    raw: string,
    deps: {
        send: SendFn;
        isAuthError: (err: unknown) => boolean;
        store: MailQueueStore;
        now?: () => number;
    },
): Promise<JobOutcome> {
    const now = deps.now ?? Date.now;
    const job = parseJob(raw);
    if (!job) {
        // Do not log the payload: it carries the OTP.
        console.error("Malformed mail job payload received; discarding it.");
        return { kind: "malformed" };
    }

    try {
        await deps.send(job.to, job.subject, job.otp);
        return { kind: "sent" };
    } catch (error) {
        const retries = (job.retries || 0) + 1;
        const failed: MailJob = { ...job, retries };

        if (deps.isAuthError(error)) {
            await deps.store.pushDlq(buildDlqEntry(failed, error, "auth", now()));
            return { kind: "dlq", reason: "auth" };
        }

        if (retries >= MAX_RETRIES) {
            console.error(`[MAX RETRIES REACHED] Failed to send email to ${job.to} after ${retries} attempts. Moving to DLQ.`);
            await deps.store.pushDlq(buildDlqEntry(failed, error, "max_retries", now()));
            return { kind: "dlq", reason: "max_retries" };
        }

        const delay = retryDelayMs(retries);
        const notBefore = now() + delay;
        console.warn(`[RETRY ${retries}/${MAX_RETRIES}] Scheduling mail to ${job.to} in ${delay / 1000}s.`);
        await deps.store.scheduleRetry(failed, notBefore);
        return { kind: "retry", retries, notBefore };
    }
}

// Atomically move up to ARGV[2] due members from the delayed zset to the ready list.
const PROMOTE_SCRIPT = `
local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, tonumber(ARGV[2]))
for _, member in ipairs(due) do
  redis.call('ZREM', KEYS[1], member)
  redis.call('RPUSH', KEYS[2], member)
end
return #due
`;

export function createRedisStore(redis: Redis, queue: string): MailQueueStore & { delayedKey: string; dlqKey: string } {
    const delayedKey = `${queue}_delayed`;
    const dlqKey = `${queue}_dlq`;
    return {
        delayedKey,
        dlqKey,
        async pop(timeoutSeconds) {
            const result = await redis.blpop(queue, timeoutSeconds);
            return result ? result[1] : null;
        },
        async scheduleRetry(job, notBefore) {
            const entry: MailJob = { ...job, notBefore, retryId: crypto.randomUUID() };
            await redis.zadd(delayedKey, notBefore, JSON.stringify(entry));
        },
        async pushDlq(entry) {
            await redis.rpush(dlqKey, JSON.stringify(entry));
        },
        async promoteDue(now) {
            const moved = await redis.eval(PROMOTE_SCRIPT, 2, delayedKey, queue, String(now), "100");
            return Number(moved) || 0;
        },
    };
}
