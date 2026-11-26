/**
 * Inngest client: saare functions isi se bante hain aur events isi se bhejte hain.
 * Inngest = background jobs chalane wali service - har step ka result yaad rakhti hai aur fail hone par retry karti hai.
 * INNGEST_DEV=1 ho to local dev server use hota hai (keys ki zaroorat nahi).
 */
import { Inngest } from "inngest";
import { config } from "dotenv";
import { JobMetricsMiddleware } from "../lib/jobMetrics";
config();

const isDev = process.env.INNGEST_DEV === "1" || process.env.INNGEST_DEV === "true";

export const inngest = new Inngest({
    id: "AudioProcessingApp",
    isDev,
    eventKey: process.env.INNGEST_EVENT_KEY,
    signingKey: process.env.INNGEST_SIGNING_KEY,
    // Har step / run ke success + failure counters, alerts ke liye (lib/jobMetrics.ts)
    middleware: [JobMetricsMiddleware],
});