import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./inngest";
import { fetchJobsFromList } from "./jobseeker/worker";
import { config } from "dotenv";
import { fetchJob } from "./functions/fechJob";
import { transcodeFunction } from "./functions/transcode";
config();

const app = express();

app.use(express.json());

const functions = [
    fetchJob,
    transcodeFunction
];

app.use("/api/inngest", serve({ client: inngest, functions }));

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
    fetchJobsFromList();
});