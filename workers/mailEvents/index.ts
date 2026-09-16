import { redis } from "./Redis";
import { sendMail } from "./NodeMailer";
import { config } from "dotenv";
config();

interface MailJob {
    to: string;
    subject: string;
    otp: string;
    retries?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RETRIES = 3;
const EMPTY_QUEUE_DELAY_MS = Number(process.env.QUEUE_EMPTY_DELAY_MS) || 2000;
const POLL_TIMEOUT_SECONDS = Number(process.env.QUEUE_POLL_TIMEOUT_SECS) || 2;

;(async (mailQueue: string) => {
    const dlqQueue = `${mailQueue}_dlq`;
    console.log(`Mail worker started. Listening on queue: "${mailQueue}", DLQ: "${dlqQueue}" (idle wait: ${EMPTY_QUEUE_DELAY_MS}ms)`);

    while (true) {
        try {
            const result = await redis.blpop(mailQueue, POLL_TIMEOUT_SECONDS);
            if (result && result[1]) {
                let data: MailJob;
                try {
                    data = JSON.parse(result[1]);
                } catch (parseErr) {
                    console.error("Malformed mail job payload. Discarding:", result[1], parseErr);
                    continue;
                }

                try {
                    await sendMail(data.to, data.subject, data.otp);
                } catch (error: any) {
                    data.retries = (data.retries || 0) + 1;

                    const isAuthError =
                        error?.code === "EAUTH" ||
                        error?.responseCode === 454 ||
                        error?.responseCode === 535 ||
                        /Too many login attempts/i.test(error?.message || "");

                    if (isAuthError) {
                        console.error(
                            `[AUTH FAILURE] Google SMTP rejected authentication (Code: ${error?.code || error?.responseCode}). ` +
                            `Moving job to DLQ (${dlqQueue}) and pausing worker for 30s to prevent rate-limit lockout.`
                        );
                        await redis.rpush(dlqQueue, JSON.stringify(data));
                        await sleep(30000);
                    } else if (data.retries >= MAX_RETRIES) {
                        console.error(
                            `[MAX RETRIES REACHED] Failed to send email to ${data.to} after ${data.retries} attempts. Moving to DLQ (${dlqQueue}).`
                        );
                        await redis.rpush(dlqQueue, JSON.stringify(data));
                    } else {
                        const delayMs = Math.min(5000 * Math.pow(2, data.retries - 1), 30000);
                        console.warn(
                            `[RETRY ${data.retries}/${MAX_RETRIES}] Retrying mail to ${data.to} in ${delayMs / 1000}s...`
                        );
                        await sleep(delayMs);
                        await redis.rpush(mailQueue, JSON.stringify(data));
                    }
                }
            } else {
                // Queue is empty: back off for 1-3 seconds to prevent continuous polling
                await sleep(EMPTY_QUEUE_DELAY_MS);
            }
        } catch (error) {
            console.error("Mail worker poll error:", error);
            await sleep(EMPTY_QUEUE_DELAY_MS);
        }
    }
})(process.env.MAIL_QUEUE || "mail_queue");