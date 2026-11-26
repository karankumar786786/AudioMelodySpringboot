/**
 * Mail queue ka logic (Redis se alag rakha hai, taaki bina Redis ke test ho sake).
 * - Ready jobs: Redis list (mail_queue) - BLPOP se nikaalte hain.
 * - Retry jobs: sorted set (mail_queue_delayed), score = kab bhejna hai (ms).
 * - Fail jobs: list (mail_queue_dlq) - OTP ke bina, sirf jaanch ke liye.
 */
import type { Redis } from "ioredis";

/** Queue me ek email job: kisko, subject, OTP, kitni baar try hua. */
export interface MailJob {
    to: string;
    subject: string;
    otp: string;
    retries?: number;
    /** Is time (epoch ms) se pehle retry wala job nahi bhejna. */
    notBefore?: number;
    /** Sorted set me har entry ko unique banata hai (same job do baar ho sake). */
    retryId?: string;
}

/** DLQ me kya rakhte hain: jaanch ke liye sab kuch, par OTP kabhi nahi. */
export interface DlqEntry {
    to: string;
    subject: string;
    retries: number;
    error: string;
    reason: "auth" | "max_retries";
    failedAt: string;
}

/** Queue ke operations ka interface (asli Redis wala createRedisStore me, tests me nakli). */
export interface MailQueueStore {
    /** Agla ready job nikalo (block karke wait); timeout pe null. */
    pop(timeoutSeconds: number): Promise<string | null>;
    /** Job ko `notBefore` ke baad retry ke liye rakho, baaki emails ko roke bina. */
    scheduleRetry(job: MailJob, notBefore: number): Promise<void>;
    pushDlq(entry: DlqEntry): Promise<void>;
    /** Jin delayed jobs ka time aa gaya unhe wapas ready queue me daalo. Kitne gaye, lautata hai. */
    promoteDue(now: number): Promise<number>;
    /** Sabse pehla delayed retry kab due hai (ms epoch); koi nahi to null. */
    nextDueAt?(): Promise<number | null>;
}

/** Khaali hone par ek BLPOP ka max wait. Upstash har command ka paisa leta hai, isliye lamba. */
export const MAX_BLOCK_SECONDS = 55;

/**
 * Agla BLPOP kitni der ruk sakta hai: poora idle wait, par kisi delayed retry ke due hone se aage nahi -
 * taaki retries time pe chalein.
 */
export function blockTimeoutSeconds(now: number, nextDueAt: number | null, maxSeconds = MAX_BLOCK_SECONDS): number {
    if (nextDueAt === null) return maxSeconds;
    return Math.min(maxSeconds, Math.max(1, Math.ceil((nextDueAt - now) / 1000)));
}

/** Email bhejne wala function. */
export type SendFn = (to: string, subject: string, body: string) => Promise<unknown>;

/** Max kitni koshish (3), phir DLQ. */
export const MAX_RETRIES = 3;
const MAX_ERROR_LENGTH = 500;

/** Retry ka wait: 5s, 10s, 20s ... max 30s. */
export function retryDelayMs(retries: number): number {
    return Math.min(5000 * Math.pow(2, retries - 1), 30000);
}

/** JSON string -> MailJob. Galat ya adhoora ho to null. */
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

/** Error ka chhota summary (code + message, max 500 characters). */
export function errorSummary(error: any): string {
    const code = error?.code || error?.responseCode || error?.name;
    const message = typeof error?.message === "string" ? error.message : String(error);
    const text = code ? `${code}: ${message}` : message;
    return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH)}…` : text;
}

/** Fail job se DLQ entry (OTP ke bina). */
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

/** Ek job ka nateeja: sent / malformed / retry / dlq. */
export type JobOutcome =
    | { kind: "sent" }
    | { kind: "malformed" }
    | { kind: "retry"; retries: number; notBefore: number }
    | { kind: "dlq"; reason: DlqEntry["reason"] };

/**
 * Queue ki ek raw entry process karo. Kabhi sleep nahi karta: fail hua email delayed set me chala jaata hai,
 * taaki baaki queue chalti rahe.
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
        // Payload log mat karo: usme OTP hai.
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

// Lua script (Redis me ek hi atomic kaam): ARGV[2] tak due jobs ko delayed set se nikaal ke ready list me daalo.
// Atomic = beech me koi doosra worker same job na utha le.
const PROMOTE_SCRIPT = `
local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, tonumber(ARGV[2]))
for _, member in ipairs(due) do
  redis.call('ZREM', KEYS[1], member)
  redis.call('RPUSH', KEYS[2], member)
end
return #due
`;

/** Asli Redis wala store: queue, "<queue>_delayed" aur "<queue>_dlq" keys. */
export function createRedisStore(redis: Redis, queue: string): MailQueueStore & { delayedKey: string; dlqKey: string; nextDueAt(): Promise<number | null> } {
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
        async nextDueAt() {
            const first = await redis.zrange(delayedKey, "0", "0", "WITHSCORES");
            return first.length >= 2 ? Number(first[1]) : null;
        },
    };
}
