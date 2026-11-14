import { z } from "zod";

/** The shapes help events travel in, shared by the client, the server and the
 * reports. The writer and reads live in `help-events.ts`. */
export const helpKinds = [
  "lesson",
  "hint",
  "example",
  "video",
  "print",
] as const;
export type HelpKind = (typeof helpKinds)[number];
/** Where it was opened. */
export const helpSources = [
  "practice",
  "lessons",
  "pathways",
  "progress",
] as const;
export type HelpSource = (typeof helpSources)[number];
/** The help an answer had, as its outcome's `help` names it. */
export const answerHelpKinds = [
  "hint",
  "lesson",
  "video",
  "example",
  "person",
] as const;
export type AnswerHelp = (typeof answerHelpKinds)[number];

/** At most this many events ride on one heartbeat; the rest wait for the next. */
export const MAX_HELP_EVENTS = 20;
/** Older events are dated this long ago: a queued event is never older. */
export const MAX_HELP_AGE_MS = 6 * 3_600_000;

const ref = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/)
  .optional();
export const helpEventSchema = z.strictObject({
  /** A print is recorded by the server when it sends the PDF, never claimed. */
  kind: z.enum(["lesson", "hint", "example", "video"]),
  source: z.enum(helpSources),
  /** The problem type (template id), or a reference lesson's id. */
  ref,
  problemId: z.string().min(1).max(160).optional(),
  step: z.number().int().min(1).max(20).optional(),
  /** How long ago it happened, by the client's own clock: an age, not a time,
   * so a wrong device clock can't misdate it. */
  ageMs: z.number().int().min(0).max(86_400_000),
});
export type HelpEvent = z.infer<typeof helpEventSchema>;

/** One kind of help in a week: how many times it was opened and the active
 * minutes on it. */
export type HelpTally = { count: number; minutes: number };
export type HelpWeek = {
  week: string;
  lessons: HelpTally;
  hints: HelpTally;
  videos: HelpTally;
  examples: HelpTally;
  prints: number;
  /** Answers given; those the engine weighs as assisted (a hint, the
   * lesson or working together); and those that had each kind of help. */
  answers: number;
  assisted: number;
  answersWith: Record<AnswerHelp, number>;
};
export const helpWeekResource = z.object({
  week: z.iso.date(),
  lessons: z.object({ count: z.number(), minutes: z.number() }),
  hints: z.object({ count: z.number(), minutes: z.number() }),
  videos: z.object({ count: z.number(), minutes: z.number() }),
  examples: z.object({ count: z.number(), minutes: z.number() }),
  prints: z.number(),
  answers: z.number(),
  assisted: z.number(),
  answersWith: z.object({
    hint: z.number(),
    lesson: z.number(),
    video: z.number(),
    example: z.number(),
    person: z.number(),
  }),
});

