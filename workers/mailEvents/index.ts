/**
 * Mail worker (Bun): Redis list "mail_queue" se email jobs uthata hai aur bhejta hai.
 *
 * Kaun daalta hai: core API (LEGACY mode me, ya Kafka ka 30 sec fallback) aur admin API OTP emails yahan push karte hain.
 * Loop: due retries wapas queue me -> BLPOP se agla job (lamba wait) -> bhejo -> fail ho to retry / DLQ.
 * Fail hone par: 3 koshish (5s, 10s, 20s ke gap pe, "mail_queue_delayed" sorted set me),
 * phir "mail_queue_dlq". Credentials hi galat hon to seedha DLQ aur 30 second ka break.
 */
import { redis } from "./Redis";
import { createMailProvider } from "./providers";
import { blockTimeoutSeconds, createRedisStore, handleRawJob, MAX_BLOCK_SECONDS } from "./lib/queue";
import { config } from "dotenv";
import { startTelemetry, recordSent, recordFailure } from "./telemetry"; // sirf metrics (OpenTelemetry)
config();

const provider = createMailProvider();

/** Ek email bhejo (chuna hua provider: smtp / ses / resend). Fail ho to error log karke aage phenko. */
async function sendMail(to: string, subject: string, text: string) {
    try {
        const { messageId } = await provider.send({ to, subject, text });
        console.log("Mail sent successfully via %s to %s: %s", provider.name, to, messageId);
    } catch (err) {
        console.error("Failed to send mail via %s to %s:", provider.name, to, err);
        throw err;
    }
}

/** ms milliseconds ruko. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ERROR_BACKOFF_MS = 5000;
const AUTH_FAILURE_PAUSE_MS = 30000;

// Upstash (Redis) har command ka paisa leta hai - khaali timeout hone wala BLPOP bhi. Isliye ek lamba
// blocking wait: khaali worker minute me bas kuch hi commands chalata hai, par naya job aate hi turant utha leta hai.
// Koi delayed retry due ho to wait pehle khatam ho jaata hai. 30-300 second ke beech rakhte hain, taaki
// purani env file ki chhoti value (pehle QUEUE_POLL_TIMEOUT_SECS=2) se tez polling wapas na aaye.
const MAX_BLOCK = Math.min(Math.max(Number(process.env.QUEUE_BLOCK_TIMEOUT_SECS) || MAX_BLOCK_SECONDS, 30), 300);

// Main loop: worker band hone tak chalta rehta hai.
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
                // BLPOP pehle hi wait kar chuka; seedha loop ke upar jao aur due retries promote karo.
                continue;
            }

            const outcome = await handleRawJob(raw, { send: sendMail, isAuthError: (e) => provider.isAuthError(e), store });
            if (outcome.kind === "sent") recordSent();
            else if (outcome.kind === "retry") recordFailure("retry");
            else if (outcome.kind === "dlq") recordFailure("dlq", outcome.reason === "auth" ? "auth" : "max_retries");

            if (outcome.kind === "dlq" && outcome.reason === "auth") {
                // Credentials har email pe reject ho rahe hain - provider ko lagataar maarne se rate-limit lock lag jaayega,
                // isliye thodi der ruk jao.
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
