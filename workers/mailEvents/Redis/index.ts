import { Redis } from "ioredis";
import { config } from "dotenv";
config();

const isSsl = process.env.REDIS_SSL_ENABLED === "true";

export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      tls: isSsl ? { rejectUnauthorized: false } : undefined,
    });