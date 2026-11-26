/**
 * Redis connection (ioredis). REDIS_URL ho to wahi, warna host/port/password alag env vars se.
 * Har command max 3 retry, connect timeout 10 second.
 */
import { Redis } from "ioredis";
import { config } from "dotenv";
config();

const isSsl = process.env.REDIS_SSL_ENABLED === "true";

export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
    })
  : new Redis({
      host: process.env.REDIS_HOST!, // na ho to error aane do, koi default nahi
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD!,
      tls: isSsl ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
    });

redis.on("error", (err) => console.error("Redis connection error:", err));