import { z } from "zod";

/**
 * Zod rules shared by the admin forms. They follow what the adminBackend views accept:
 * required fields are the ones a view rejects or ignores when blank, and number fields
 * are the minute/second pairs the views combine into seconds.
 */

/** An optional whole number typed into an <input type="number">; "" means not set. */
export const optionalWhole = (max?: number) =>
  z
    .union([
      z.literal(""),
      z.coerce.number().int("Whole numbers only").min(0, "Must be 0 or more"),
    ])
    .refine((v) => v === "" || max === undefined || v <= max, {
      message: `Must be ${max} or less`,
    });

export const minutes = optionalWhole(999);
export const seconds = optionalWhole(59);

export type OptionalWhole = z.infer<ReturnType<typeof optionalWhole>>;

/** min/sec pair to total seconds, or null when both are blank. */
export function toSeconds(
  min: OptionalWhole,
  sec: OptionalWhole,
): number | null {
  if (min === "" && sec === "") return null;
  return (min === "" ? 0 : min) * 60 + (sec === "" ? 0 : sec);
}

export function fromSeconds(total: number | null | undefined): {
  min: OptionalWhole;
  sec: OptionalWhole;
} {
  if (total === null || total === undefined || total < 0)
    return { min: "", sec: "" };
  return { min: Math.floor(total / 60), sec: total % 60 };
}

export const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

/** LRCLIB ids are numeric; the backend treats 0 or blank as "no lyrics". */
export const lrclibId = z
  .string()
  .trim()
  .regex(/^\d*$/, "LRCLIB ID must be a number");

export const fileOrNull = z.custom<File | null>(
  (v) => v === null || (typeof File !== "undefined" && v instanceof File),
);

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");
