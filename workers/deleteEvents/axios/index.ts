import axios from "axios";
import { config } from "dotenv";
config();

const baseURL = process.env.APPLICATION_URL || "http://localhost:9090/webhook/job";
const deleteBaseURL = process.env.APPLICATION_DELETE_URL || baseURL.replace(/\/job\/?$/, "/delete");

export const api = axios.create({
    baseURL: baseURL,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.APPLICATION_API_KEY || "",
    },
});

export const deleteApi = axios.create({
    baseURL: deleteBaseURL,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.APPLICATION_API_KEY || "",
    },
});
