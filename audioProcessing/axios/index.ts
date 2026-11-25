import axios from "axios";
import { config } from "dotenv";
config();

const baseURL = process.env.APPLICATION_URL || "http://localhost:8000/webhook/job";
const deleteBaseURL = process.env.APPLICATION_DELETE_URL || baseURL.replace(/\/job\/?$/, "/delete");
const shortBaseURL = process.env.APPLICATION_SHORT_URL || baseURL.replace(/\/job\/?$/, "/short");

export const api = axios.create({
    baseURL: baseURL,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.APPLICATION_API_KEY || ""
    },
});

export const deleteApi = axios.create({
    baseURL: deleteBaseURL,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.APPLICATION_API_KEY || ""
    },
});

/** Admin API webhooks for Shorts: /webhook/short/{shortId}/processed | /failed */
export const shortApi = axios.create({
    baseURL: shortBaseURL,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.APPLICATION_API_KEY || ""
    },
});
