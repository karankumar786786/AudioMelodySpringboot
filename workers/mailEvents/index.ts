import { redis } from "./Redis";
import { createMailProvider } from "./providers";
import { createRedisStore, handleRawJob } from "./lib/queue";
import { config } from "dotenv";
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
const EMPTY_QUEUE_DELAY_MS = Number(process.env.QUEUE_EMPTY_DELAY_MS) || 2000;
const POLL_TIMEOUT_SECONDS = Number(process.env.QUEUE_POLL_TIMEOUT_SECS) || 2;
const AUTH_FAILURE_PAUSE_MS = 30000;

;(async (mailQueue: string) => {
    const store = createRedisStore(redis, mailQueue);
    console.log(
        `Mail worker started (provider: ${provider.name}). Listening on queue: "${mailQueue}", delayed: "${store.delayedKey}", DLQ: "${store.dlqKey}" (idle wait: ${EMPTY_QUEUE_DELAY_MS}ms)`
    );

    while (true) {
        try {
            await store.promoteDue(Date.now());

            const raw = await store.pop(POLL_TIMEOUT_SECONDS);
            if (raw === null) {
                await sleep(EMPTY_QUEUE_DELAY_MS);
                continue;
            }

            const outcome = await handleRawJob(raw, { send: sendMail, isAuthError: (e) => provider.isAuthError(e), store });

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
            await sleep(EMPTY_QUEUE_DELAY_MS);
        }
    }
})(process.env.MAIL_QUEUE || "mail_queue");
