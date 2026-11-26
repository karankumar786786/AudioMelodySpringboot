/**
 * Admin API ke webhooks ke HTTP clients (axios). Har request me X-API-KEY header jaata hai.
 *  - api:       /webhook/job/<jobId>/...        (upload pipeline)
 *  - deleteApi: /webhook/delete/<type>/<id>/... (delete chain)
 *  - shortApi:  /webhook/short/<shortId>/...    (shorts)
 * deleteApi / shortApi ke URL alag set na hon to APPLICATION_URL ke aakhri "/job" ko badal ke bante hain.
 */
import axios from "axios";
import { config } from "dotenv";
config();

const baseURL = process.env.APPLICATION_URL || "http://localhost:8000/webhook/job";
const deleteBaseURL = process.env.APPLICATION_DELETE_URL || baseURL.replace(/\/job\/?$/, "/delete");
const shortBaseURL = process.env.APPLICATION_SHORT_URL || baseURL.replace(/\/job\/?$/, "/short");

/** Ek axios client banao: diya hua base URL, 10 second timeout, JSON aur X-API-KEY header. */
function createWebhookClient(clientBaseURL: string) {
    return axios.create({
        baseURL: clientBaseURL,
        timeout: 10000,
        headers: {
            "Content-Type": "application/json",
            "X-API-KEY": process.env.APPLICATION_API_KEY || ""
        },
    });
}

/** Upload job ke webhooks: /webhook/job/{jobId}/... */
export const api = createWebhookClient(baseURL);

/** Delete chain ke webhooks: /webhook/delete/{type}/{id}/... */
export const deleteApi = createWebhookClient(deleteBaseURL);

/** Shorts ke webhooks: /webhook/short/{shortId}/processed | /failed */
export const shortApi = createWebhookClient(shortBaseURL);
