/** The pilot interest list at `/research/pilot`: who wants to hear when AMP's
 * pilot study (RR-3) opens enrolment. It is a list, not enrolment. Nothing on
 * it is research data, and nobody on it is a participant until they give
 * research permission through the study itself. Nothing confirms an address
 * either: anyone can add or change an entry. So the first message to the list
 * asks each person to confirm, and nothing else (AMP news included) goes to an
 * address until it has. The page and the server share
 * these choices, so a label and the value stored never drift apart. */
import { z } from "zod";
import { stateNames } from "../web/us-states.js";

export const pilotRoles = {
  parent: "A parent or guardian",
  educator: "A teacher or school leader",
} as const;
export const pilotSettings = {
  home: "At home (including ESA families)",
  microschool: "Microschool or co-op",
  private: "Private school",
  public: "Public or charter school",
} as const;
export const pilotBands = {
  "k-2": "K–2",
  "3-5": "3–5",
  "6-8": "6–8",
  "9-12": "9–12",
} as const;
/** The normed tests the pilot accepts (RR-3), and the two other answers. */
export const pilotTests = {
  map: "MAP Growth",
  iready: "i-Ready",
  star: "Star Math",
  other: "Another test",
  none: "None yet",
} as const;
/** Outside the US is a real answer: the list is open to anyone, and the study
 * says later where it can run. */
export const OUTSIDE_US = "outside";
export const pilotPlaces: Record<string, string> = {
  ...stateNames,
  [OUTSIDE_US]: "Outside the US",
};

type Keys<T> = [keyof T & string, ...(keyof T & string)[]];
const keys = <T extends object>(choices: T) => Object.keys(choices) as Keys<T>;
/** One line of text a person typed: trimmed, bounded, no control characters. */
const line = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value));
/** A set of choices: each at most once, in the order offered. */
const choices = <T extends object>(options: T, min: number) =>
  z
    .array(z.enum(keys(options)))
    .min(min)
    .max(Object.keys(options).length)
    .transform((picked) =>
      keys(options).filter((option) => picked.includes(option)),
    );

export const pilotInterestSchema = z.strictObject({
  role: z.enum(keys(pilotRoles)),
  name: line(100).optional(),
  email: z.email().max(254),
  learners: z.number().int().min(1).max(100_000),
  bands: choices(pilotBands, 1),
  setting: z.enum(keys(pilotSettings)),
  place: z.enum(keys(pilotPlaces)),
  tests: choices(pilotTests, 0),
  source: line(300).optional(),
  /** AMP's occasional news as well as the study's own messages. */
  news: z.boolean(),
  /** The trap field (ui/Honeypot): filled only by form fillers. */
  website: z.string().max(200).optional(),
});
export type PilotInterest = z.input<typeof pilotInterestSchema>;
export type PilotInterestRow = z.output<typeof pilotInterestSchema>;
