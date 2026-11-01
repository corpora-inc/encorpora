import { z } from "zod";
import { AppError } from "../../lib/AppError";
import type { WorkbookPaper } from "../../../workbook/contracts";

export const workbookSearchSchema = z.object({
  minutes: z
    .union([z.literal(30), z.literal(45), z.literal(60)])
    .optional()
    .catch(undefined),
  paper: z.enum(["letter", "a4"]).optional().catch(undefined),
  number: z.coerce.number().int().min(1).max(999).optional().catch(undefined),
});
export type WorkbookSearch = z.infer<typeof workbookSearchSchema>;

/** The device's calendar date, YYYY-MM-DD. */
export function localDate(at = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}
export const isDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function dateLabel(date: string, style: "long" | "short" = "long") {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: style,
    month: style,
    day: "numeric",
    ...(style === "short" ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** Letter in the Americas and the Philippines; A4 elsewhere. */
const letterRegions = new Set(
  "US CA MX PH CL CO VE GT CR PA DO PR SV NI HN".split(" "),
);
export function defaultPaper(): WorkbookPaper {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return region && !letterRegions.has(region) ? "a4" : "letter";
  } catch {
    return "letter";
  }
}

export const sectionNames = {
  "warm-up": "Warm-up",
  lesson: "Today's idea",
  practice: "Practice",
  review: "Review",
  challenge: "Challenge",
} as const;

/** The server words workbook failures for parents; generic transport
 * failures keep the shared message. */
export function workbookMessage(error: unknown, fallback: string): string {
  if (
    error instanceof AppError &&
    error.code &&
    error.code !== "Invalid request" &&
    [400, 403, 404, 409, 503].includes(error.status ?? 0)
  )
    return error.code;
  return error instanceof Error && error.message ? error.message : fallback;
}
