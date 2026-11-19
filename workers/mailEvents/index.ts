import { redis } from "./Redis";
import { createMailProvider } from "./providers";
import { blockTimeoutSeconds, createRedisStore, handleRawJob, MAX_BLOCK_SECONDS } from "./lib/queue";
import { config } from "dotenv";
import { startTelemetry, recordSent, recordFailure } from "./telemetry"; // metrics only
config();

const provider = createMailProvider();

async function sendMail(to: string, subject: string, text: string) {
    try {
        const { messageId } = await provider.send({ to, subject, text });
        console.log("Mail sent successfully via %s to %s: %s", provider.name, to, messageId);
    } catch (err) {
        console.error("Failed to send mail via %s to %s:", provider.name, to, err);
        throw err;
    }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ERROR_BACKOFF_MS = 5000;
const AUTH_FAILURE_PAUSE_MS = 30000;

// Upstash bills every command, including a BLPOP that times out empty. One long
// blocking wait keeps an idle worker at a few commands a minute while still picking up
// a new job the moment it is pushed; the wait is cut short when a delayed retry is
// due. Clamped so a small value in an old env file (the previous
// QUEUE_POLL_TIMEOUT_SECS=2) can't bring back fast polling.
const MAX_BLOCK = Math.min(Math.max(Number(process.env.QUEUE_BLOCK_TIMEOUT_SECS) || MAX_BLOCK_SECONDS, 30), 300);

;(async (mailQueue: string) => {
    const store = createRedisStore(redis, mailQueue);
    startTelemetry(async () => ({
        [mailQueue]: await redis.llen(mailQueue),
        [store.dlqKey]: await redis.llen(store.dlqKey),
    }));
    console.log(
        `Mail worker started (provider: ${provider.name}). Listening on queue: "${mailQueue}", delayed: "${store.delayedKey}", DLQ: "${store.dlqKey}" (blocking wait up to ${MAX_BLOCK}s)`
    );

    while (true) {
        try {
            await store.promoteDue(Date.now());

            const timeout = blockTimeoutSeconds(Date.now(), await store.nextDueAt(), MAX_BLOCK);
            const raw = await store.pop(timeout);
            if (raw === null) {
                // BLPOP already waited; loop straight back to promote any retry now due.
                continue;
            }

            const outcome = await handleRawJob(raw, { send: sendMail, isAuthError: (e) => provider.isAuthError(e), store });
            if (outcome.kind === "sent") recordSent();
            else if (outcome.kind === "retry") recordFailure("retry");
            else if (outcome.kind === "dlq") recordFailure("dlq", outcome.reason === "auth" ? "auth" : "max_retries");

            if (outcome.kind === "dlq" && outcome.reason === "auth") {
                // Credentials are rejected for every message, so pause the provider
                // briefly rather than hammering it into a rate-limit lockout.
                console.error(
                    `[AUTH FAILURE] Mail provider rejected authentication. Job moved to DLQ (${store.dlqKey}); pausing ${AUTH_FAILURE_PAUSE_MS / 1000}s.`
                );
                await sleep(AUTH_FAILURE_PAUSE_MS);
            }
        } catch (error) {
            console.error("Mail worker poll error:", error);
            await sleep(ERROR_BACKOFF_MS);
        }
    }
})(process.env.MAIL_QUEUE || "mail_queue");
