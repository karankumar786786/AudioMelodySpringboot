import express from "express";
import { serve } from "inngest/express";
import { testFunction } from "./functions/testFunction";
import { inngest } from "./inngest";
import { fetchJobsFromList } from "./jobseeker/worker";
import { config } from "dotenv";
import { fetchJob } from "./functions/fechJob";
config();

const app = express();

app.use(express.json());

const functions = [
    testFunction,
    fetchJob
];

app.use("/api/inngest", serve({ client: inngest, functions }));

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
    // Start listening for background jobs from Redis queue
    fetchJobsFromList();
});