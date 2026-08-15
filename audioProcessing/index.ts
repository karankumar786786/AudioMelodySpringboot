import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./inngest";
import { fetchJobsFromList } from "./jobseeker/worker";
import { config } from "dotenv";
import { fetchJob } from "./functions/fechJob";
import { transcodeSong } from "./functions/transcode";
import { indexRecombee } from "./functions/saveInRecombee";
import { indexAlgolia } from "./functions/saveInAlgolia";
import { finalizeSong } from "./functions/createSongInTable";
config();

const app = express();

app.use(express.json());


const functions = [
    fetchJob,
    transcodeSong,
    indexRecombee,
    indexAlgolia,
    finalizeSong,
];

app.use("/api/inngest", serve({ client: inngest, functions }));

app.listen(5010, () => {
    console.log("Server running on http://localhost:5010");
    fetchJobsFromList();
});