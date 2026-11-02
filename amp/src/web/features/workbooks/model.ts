import { z } from "zod";
import { AppError } from "../../lib/AppError";
import {
  workbookLeans,
  type WorkbookChoicesInput,
  type WorkbookPaper,
} from "../../../workbook/contracts";

export const workbookSearchSchema = z.object({
  minutes: z
    .union([z.literal(30), z.literal(45), z.literal(60)])
    .optional()
    .catch(undefined),
  paper: z.enum(["letter", "a4"]).optional().catch(undefined),
  number: z.coerce.number().int().min(1).max(999).optional().catch(undefined),
  /** The workbook's choices: areas (comma-separated strands), lean, and
   * `lesson=off` for problems only. Absent: mixed, at level, with a lesson. */
  areas: z.string().max(400).optional().catch(undefined),
  lean: z.enum(workbookLeans).optional().catch(undefined),
  lesson: z.literal("off").optional().catch(undefined),
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
    [400, 403, 404, 409, 410, 503].includes(error.status ?? 0)
  )
    return error.code;
  return error instanceof Error && error.message ? error.message : fallback;
}

export const defaultWorkbookChoices: WorkbookChoicesInput = {
  areas: [],
  lean: "level",
  lesson: true,
};
/** Choices from the URL. */
export function searchChoices(search: WorkbookSearch): WorkbookChoicesInput {
  return {
    areas: [...new Set((search.areas ?? "").split(",").filter(Boolean))].sort(),
    lean: search.lean ?? "level",
    lesson: search.lesson !== "off",
  };
}
/** Choices as URL search parameters; defaults are left out. */
export function choicesSearch(choices: WorkbookChoicesInput) {
  return {
    areas: choices.areas.length
      ? [...choices.areas].sort().join(",")
      : undefined,
    lean: choices.lean === "level" ? undefined : choices.lean,
    lesson: choices.lesson ? undefined : ("off" as const),
  };
}
export const sameChoices = (a: WorkbookChoicesInput, b: WorkbookChoicesInput) =>
  a.lean === b.lean &&
  a.lesson === b.lesson &&
  [...a.areas].sort().join(",") === [...b.areas].sort().join(",");

export const leanNames = {
  easier: "Easier",
  level: "At level",
  stretch: "Harder",
} as const;
/** A short line for a workbook's choices; empty for the defaults. */
export function choicesLabel(
  choices: WorkbookChoicesInput,
  areaName: (id: string) => string,
): string {
  return [
    choices.areas.map(areaName).join(", "),
    choices.lean === "level" ? "" : leanNames[choices.lean],
    choices.lesson ? "" : "Problems only",
  ]
    .filter(Boolean)
    .join(" · ");
}
