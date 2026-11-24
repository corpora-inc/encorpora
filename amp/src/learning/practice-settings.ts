import { z } from "zod";
import { colorfulAllowed, lookSchema } from "./look";

export const practiceSettingsSchema = z.object({
  revision: z.number().int().nonnegative(),
  epoch: z.number().int().nonnegative(),
  workingTogether: z.boolean(),
  focusSkillId: z.string().nullable(),
  /** A grown-up's choice for the child: grade levels on the screens they
   * see as themselves. Off, their levels and Pathways name no grade. */
  gradeLevelShown: z.boolean().default(true),
  /** How practice looks for this learner: their own choice. Null: they
   * have not chosen, and start where their age does (`resolveLook`). Kept
   * while Colorful is off, and theirs again when it is allowed. */
  look: lookSchema.nullable().default(null),
  /** A grown-up's switch for the child, "Allow Colorful". Off: the child is
   * in Calm and has no Look choice. Read it with `allowsColorful`. */
  colorfulAllowed: z.boolean().default(true),
  /** Before the switch: a grown-up's lock on `look`. Only read, and only
   * as "off" where it held Calm (`allowsColorful`); every change of the
   * switch clears it, so the switch is then the one record. */
  lookAdultLock: z.boolean().default(false),
  /** In Colorful, the one hue (0 to 359 degrees) the learner chose to keep.
   * Null: the color moves on with every problem. Theirs alone: no lock
   * holds it, and it means nothing in Calm. */
  lookHue: z.number().int().min(0).max(359).nullable().default(null),
  strandStarts: z
    .record(
      z.string(),
      z.object({
        level: z.number().min(0).max(12),
        revision: z.number().int().nonnegative(),
      }),
    )
    .default({}),
});
export type PracticeSettings = z.infer<typeof practiceSettingsSchema>;
/** Whether the learner's grown-up allows Colorful: the switch, or (stored
 * before it) anything but a lock on Calm (`colorfulAllowed`, learning/look). */
export const allowsColorful = (
  settings: Pick<
    PracticeSettings,
    "look" | "colorfulAllowed" | "lookAdultLock"
  >,
): boolean =>
  settings.colorfulAllowed &&
  colorfulAllowed(settings.look, settings.lookAdultLock);
export const defaultPracticeSettings = (): PracticeSettings => ({
  revision: 0,
  epoch: 0,
  workingTogether: false,
  focusSkillId: null,
  gradeLevelShown: true,
  look: null,
  colorfulAllowed: true,
  lookAdultLock: false,
  lookHue: null,
  strandStarts: {},
});
const identity = {
  requestId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
};
export const practiceChangeSchema = z.discriminatedUnion("kind", [
  z.object({ ...identity, kind: z.literal("reset") }).strict(),
  z
    .object({
      ...identity,
      kind: z.literal("easier"),
      problemId: z.string().min(1).max(160),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("together"),
      enabled: z.boolean(),
      problemId: z.string().min(1).max(160).optional(),
    })
    .strict(),
  z
    .object({ ...identity, kind: z.literal("gradeLevel"), shown: z.boolean() })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("look"),
      look: lookSchema.nullable(),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("allowColorful"),
      allowed: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("lookHue"),
      hue: z.number().int().min(0).max(359).nullable(),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("focus"),
      skillId: z.string().min(1).max(160).nullable(),
    })
    .strict(),
]);
export type PracticeChange = z.infer<typeof practiceChangeSchema>;

/** What `/practice-state` answers: the stored settings, the look that
 * applies to this learner now, whether Colorful is off for them
 * (`lookLocked`: then they are in Calm and have no Look choice), and their
 * points (`learning/points.ts`) so practice shows the total on first paint.
 * Points may be absent (an older server); a screen then shows none. */
export const practiceStateSchema = practiceSettingsSchema.extend({
  effectiveLook: lookSchema,
  lookLocked: z.boolean(),
  /** Who turned Colorful off: the class (or its school), or a grown-up. */
  lookLockedBy: z.enum(["class", "adult"]).nullable().default(null),
  points: z.number().int().nonnegative().optional(),
});
export type PracticeState = z.infer<typeof practiceStateSchema>;
