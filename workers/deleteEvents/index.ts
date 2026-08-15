import express from "express";
import { serve } from "inngest/express";
import { config } from "dotenv";
import { inngest } from "./inngest";
import { fetchDeleteEventsFromList } from "./jobseeker/deleteWorker";
import { deleteAlgolia } from "./functions/deleteAlgolia";
import { deleteRecombee } from "./functions/deleteRecombee";
import { deleteImageKit } from "./functions/deleteImageKit";
import { deleteS3 } from "./functions/deleteS3";
import { finalizeDelete } from "./functions/finalizeDelete";

config();

const app = express();

app.use(express.json());

const functions = [
    deleteAlgolia,
    deleteRecombee,
    deleteImageKit,
    deleteS3,
    finalizeDelete,
];

app.use("/api/inngest", serve({ client: inngest, functions }));

app.listen(5020, () => {
    console.log("Delete worker server running on http://localhost:5020");
    fetchDeleteEventsFromList();
});