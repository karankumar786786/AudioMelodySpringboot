/**
 * Internal API key check (X-API-KEY header) - admin API aur Inngest jab is service ke job endpoints
 * call karte hain to ye key bhejte hain. Bina sahi key ke koi job trigger nahi kar sakta.
 */
import type { RequestHandler } from "express";
import { timingSafeEqual } from "crypto";

/** Set ki hui API key lao. Har request pe padhte hain (start pe ek baar nahi) taaki env badle ya tests key badlein to asar ho. Khaali = undefined. */
export function getConfiguredApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.AUDIO_PROCESSING_API_KEY || env.APPLICATION_API_KEY;
  return key && key.length > 0 ? key : undefined;
}

/**
 * Key match karo "constant time" me - har baar utna hi time lagta hai, chahe pehla akshar galat ho ya aakhri.
 * Isse koi time naap ke key andaza nahi laga sakta (timing attack). Key na ho ya lambai alag ho to false.
 */
export function isValidApiKey(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Express middleware: X-API-KEY header check karta hai.
 * "Fail closed": server pe key set hi nahi hai to har request 503 se mana - galti se khula na reh jaaye.
 * Galat / missing key = 401. Sahi key = next() se aage.
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
