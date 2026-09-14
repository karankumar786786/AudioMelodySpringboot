import { Inngest } from "inngest";
import { config } from "dotenv";
config();

const isDev = process.env.INNGEST_DEV === "1" || process.env.INNGEST_DEV === "true";

export const inngest = new Inngest({
    id: "AudioProcessingApp",
    isDev,
    eventKey: process.env.INNGEST_EVENT_KEY,
    signingKey: process.env.INNGEST_SIGNING_KEY,
});