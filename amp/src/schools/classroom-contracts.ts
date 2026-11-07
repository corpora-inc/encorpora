import { z } from "zod";
import {
  workbookDateSchema,
  workbookMinutesSchema,
  workbookPapers,
  workbookSectionKinds,
} from "../workbook/contracts.js";
import {
  deviceModes,
  levelVisibilities,
  standingsMeasures,
  standingsScopes,
  type SchoolSettings,
} from "./settings.js";
import type { ExperiencePreset } from "./setup-contracts.js";

/** The API shapes of a class's student experience, standings and workbook
 * stack. Shared by the routes and their screens. */

/** The settings a screen offers. The weekly target is the gradebook's. */
export const experienceKeys = [
  "levels",
  "standings",
  "measure",
  "deviceMode",
] as const;
export type ExperienceKey = (typeof experienceKeys)[number];
/** A starting point decides what students see. Device mode is about the
 * devices, so it stays as it is. */
export type PresetKey = Exclude<ExperienceKey, "deviceMode">;
export type ExperienceValues = Pick<SchoolSettings, PresetKey>;

/** What each starting point sets. */
export const experienceValues: Record<ExperiencePreset, ExperienceValues> = {
  quiet: { levels: "hidden", standings: "off", measure: "growth" },
  levels: { levels: "shown", standings: "off", measure: "growth" },
  competition: { levels: "shown", standings: "class", measure: "growth" },
};

const namedScope = z.object({
  kind: z.enum(["org", "class", "person"]),
  id: z.uuid(),
  name: z.string(),
});
export type NamedScope = z.infer<typeof namedScope>;
const experienceSetting = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    /** Null: nobody has chosen, so this is where AMP starts. */
    setBy: namedScope.nullable(),
    lockedBy: namedScope.nullable(),
    /** This scope holds its own value. */
    own: z.boolean(),
    /** Who this scope would follow if it stopped setting it. */
    inherited: z.object({ value, from: namedScope.nullable() }),
  });
export const experienceResource = z.object({
  scope: z.object({
    kind: z.enum(["org", "class"]),
    id: z.uuid(),
    name: z.string(),
  }),
  canEdit: z.boolean(),
  /** Whether a lock here means anything: an admin, at an org. */
  canLock: z.boolean(),
  /** The boards that exist here: a school on its own has no district. */
  standingsOptions: z.array(z.enum(standingsScopes)),
  settings: z.object({
    levels: experienceSetting(z.enum(levelVisibilities)),
    standings: experienceSetting(z.enum(standingsScopes)),
    measure: experienceSetting(z.enum(standingsMeasures)),
    deviceMode: experienceSetting(z.enum(deviceModes)),
  }),
  /** A class's roster, with who the teacher left off standings. */
  students: z
    .array(z.object({ id: z.uuid(), name: z.string(), leftOff: z.boolean() }))
    .optional(),
});
export type Experience = z.infer<typeof experienceResource>;

const writableValues = z.strictObject({
  /** Null: stop setting this here, and follow the level above. */
  levels: z.enum(levelVisibilities).nullable().optional(),
  standings: z.enum(standingsScopes).nullable().optional(),
  measure: z.enum(standingsMeasures).nullable().optional(),
  deviceMode: z.enum(deviceModes).nullable().optional(),
});
export const classExperienceWriteSchema = z.strictObject({
  values: writableValues,
});
export const orgExperienceWriteSchema = z.strictObject({
  values: writableValues.optional(),
  locks: z
    .strictObject({
      levels: z.boolean().optional(),
      standings: z.boolean().optional(),
      measure: z.boolean().optional(),
      deviceMode: z.boolean().optional(),
    })
    .optional(),
});
export const leaveOffSchema = z.strictObject({ leftOff: z.boolean() });

/* Standings, for a student. */
export const boardScopes = ["class", "school", "district"] as const;
export type BoardScope = (typeof boardScopes)[number];
export const standingsBoardsResource = z.object({
  boards: z.array(
    z.object({
      classId: z.uuid(),
      className: z.string(),
      scope: z.enum(boardScopes),
    }),
  ),
});
export const standingsBoardResource = z.object({
  board: z.object({
    classId: z.uuid(),
    className: z.string(),
    scope: z.enum(boardScopes),
    /** The school or district a wider board covers. */
    placeName: z.string(),
    /** Wider boards group by grade; null when this student has none set. */
    gradeLevel: z.number().int().nullable(),
    measure: z.enum(standingsMeasures),
  }),
  /** At most ten, and never down to the last place. */
  top: z.array(
    z.object({
      rank: z.number().int(),
      name: z.string(),
      value: z.number(),
      you: z.boolean(),
    }),
  ),
  you: z.object({
    name: z.string(),
    value: z.number(),
    thisWeek: z.number(),
    /** Only when this student is on the list. */
    rank: z.number().int().nullable(),
  }),
});
export type StandingsBoard = z.infer<typeof standingsBoardResource>;

/* The workbook stack. */
export const stackWorkbookSchema = z.strictObject({
  date: workbookDateSchema,
  minutes: workbookMinutesSchema,
  paper: z.enum(workbookPapers),
  /** Fixed by the caller, so a retry finds the same workbook. */
  number: z.number().int().min(1).max(999),
  /** Lean on this skill: a teacher's group sheet. */
  skill: z.string().trim().min(1).max(120).optional(),
});
export type StackWorkbookInput = z.infer<typeof stackWorkbookSchema>;
export const stackWorkbookResource = z.object({
  id: z.string(),
  date: z.string(),
  number: z.number().int(),
  minutes: workbookMinutesSchema,
  problems: z.number().int(),
});
const stackSet = z.object({
  date: z.string(),
  number: z.number().int(),
  minutes: workbookMinutesSchema,
  students: z.number().int(),
  /** Students with at least one mark saved. */
  marked: z.number().int(),
  /** The skill a group sheet leaned on. Printing again never reuses one. */
  focus: z.string().nullable(),
});
export type StackSet = z.infer<typeof stackSet>;
export const stackResource = z.object({
  class: z.object({ id: z.uuid(), name: z.string() }),
  today: z.string(),
  /** The last day a new workbook can be made for. */
  lastDate: z.string(),
  canPrint: z.boolean(),
  /** Whether this server can render PDFs at all. */
  pdf: z.boolean(),
  students: z.array(
    z.object({ id: z.uuid(), name: z.string(), seated: z.boolean() }),
  ),
  /** Sets made lately, newest first. */
  recent: z.array(stackSet),
  /** The skill a group sheet leans on, when the link named a real one. */
  focus: z.object({ id: z.string(), title: z.string() }).nullable(),
});
export type StackView = z.infer<typeof stackResource>;

export const paperMarks = ["right", "not-yet"] as const;
export type PaperMark = (typeof paperMarks)[number];
const markedProblem = z.object({
  n: z.number().int(),
  section: z.enum(workbookSectionKinds),
  label: z.string(),
  /** Saved, and part of the student's record from then on. */
  mark: z.enum(paperMarks).nullable(),
});
export type MarkedProblem = z.infer<typeof markedProblem>;
export const marksResource = z.object({
  class: z.object({ id: z.uuid(), name: z.string() }),
  date: z.string(),
  /** The workbook number these rows are for; null when none was made. */
  set: z.number().int().nullable(),
  sets: z.array(stackSet),
  canMark: z.boolean(),
  students: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      workbook: z
        .object({
          id: z.string(),
          minutes: workbookMinutesSchema,
          code: z.string(),
          /** Its problems changed since it was printed: it can't be marked. */
          stale: z.boolean(),
          problems: z.array(markedProblem),
        })
        .nullable(),
    }),
  ),
});
export type MarksView = z.infer<typeof marksResource>;
export const marksQuerySchema = z.strictObject({
  date: workbookDateSchema,
  set: z.coerce.number().int().min(1).max(999).optional(),
});
export const stackQuerySchema = z.strictObject({
  skill: z.string().trim().max(120).optional(),
});
export const saveMarksSchema = z.strictObject({
  entries: z
    .array(
      z.strictObject({
        n: z.number().int().min(1).max(200),
        mark: z.enum(paperMarks),
      }),
    )
    .min(1)
    .max(200),
});
export const savedMarksResource = z.object({
  /** How many were new; saving the same marks again adds none. */
  recorded: z.number().int(),
  problems: z.array(markedProblem),
});
