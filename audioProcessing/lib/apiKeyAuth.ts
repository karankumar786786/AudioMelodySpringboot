import type { RequestHandler } from "express";
import { timingSafeEqual } from "crypto";

/** Resolve the internal API key, read at request time so env changes and tests are honoured. */
export function getConfiguredApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.AUDIO_PROCESSING_API_KEY || env.APPLICATION_API_KEY;
  return key && key.length > 0 ? key : undefined;
}

/** Constant-time comparison; returns false for missing or differently sized keys. */
export function isValidApiKey(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Protects internal job endpoints with the X-API-KEY header.
 * Fails closed: if no key is configured, every request is rejected with 503.
 */
export const requireApiKey: RequestHandler = (req, res, next) => {
  const configuredKey = getConfiguredApiKey();

  if (!configuredKey) {
    console.error(
      "[AUTH ERROR] Neither AUDIO_PROCESSING_API_KEY nor APPLICATION_API_KEY is configured; rejecting internal API request."
    );
    res.status(503).json({
      status: 503,
      error: "Service Unavailable",
      message: "Internal API key is not configured on audioProcessing",
    });
    return;
  }

  const providedKey = req.header("X-API-KEY");

  if (!isValidApiKey(providedKey, configuredKey)) {
    console.warn(
      `[AUTH REJECT] Unauthorized attempt from ${req.ip} for ${req.method} ${req.originalUrl}`
    );
    res.status(401).json({
      status: 401,
      error: "Unauthorized",
      message: "Invalid or missing X-API-KEY header",
    });
    return;
  }

  next();
};
