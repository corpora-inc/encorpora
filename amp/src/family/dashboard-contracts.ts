import { z } from "zod";
import { areaIds, type AreaId } from "../curriculum/areas.js";

// The family dashboard's contract, apart from ./projection-contracts so the
// web app's entry (which reads the projection on every screen) never carries
// it: the family's Today loads it with its route.

/** Why AMP picked a child's recent problems, as keys a screen words:
 * `catching-up` (a missed prerequisite, or a skill missed lately),
 * `reviewing` (a strong skill whose review is due), `checking-earlier` (a
 * check of the ground below the level), `new-ground` (at or past the
 * level), `chosen` (a skill an adult or the child picked). */
export const focusKeys = [
  "catching-up",
  "reviewing",
  "checking-earlier",
  "new-ground",
  "chosen",
] as const;
export type FocusKey = (typeof focusKeys)[number];
const skillRef = z.object({ id: z.string(), title: z.string() });
/** A level on the grade axis (K = 0 … Precalculus = 12): the best guess,
 * the likely range and the answers behind it. Numbers only; a screen
 * decides whether to name a grade (`gradeLevelShown`). */
const dashboardLevel = z.object({
  level: z.number(),
  low: z.number(),
  high: z.number(),
  answered: z.number().int().nonnegative(),
});
export const familyDashboardSchema = z.object({
  familyId: z.uuid(),
  /** The family's date, and the week so far (Monday through today). */
  today: z.iso.date(),
  week: z.object({ from: z.iso.date(), to: z.iso.date() }),
  /** How the children get in on their own devices, for a reader who may
   * manage them, while the family's class is open: the code as shown and
   * the app path it opens (`/join/ABC-234`). */
  join: z.object({ code: z.string(), path: z.string() }).nullable(),
  children: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      /** The parent's switch: whether this child's screens name grades. */
      gradeLevelShown: z.boolean(),
      week: z.object({
        days: z.number().int().nonnegative(),
        minutes: z.number(),
        problems: z.number().int().nonnegative(),
        correct: z.number().int().nonnegative(),
        independent: z.number().int().nonnegative(),
        lastPracticed: z.iso.date().nullable(),
      }),
      /** Every day of the week so far, oldest first, zeros included. */
      daily: z.array(
        z.object({
          day: z.iso.date(),
          minutes: z.number(),
          problems: z.number().int().nonnegative(),
        }),
      ),
      /** The overall level; null before the first answer. */
      level: dashboardLevel.nullable(),
      /** The five areas, always in `curriculum/areas.ts` order. */
      areas: z.array(
        z.object({
          area: z.enum(areaIds as [AreaId, ...AreaId[]]),
          title: z.string(),
          /** This area's own level; null before an answer in it. */
          level: dashboardLevel.nullable(),
          /** The skills of the whole grades just below the level (the
           * area's, else the overall one), each in one bucket. Null with no
           * level or nothing below it. */
          checked: z
            .object({
              /** Inclusive whole grades checked. */
              from: z.number().int(),
              to: z.number().int(),
              skills: z.number().int().nonnegative(),
              strong: z.number().int().nonnegative(),
              earned: z.number().int().nonnegative(),
              tried: z.number().int().nonnegative(),
              notAsked: z.number().int().nonnegative(),
              /** Not asked yet, nearest the level first. */
              nearestNotAsked: z.array(skillRef),
            })
            .nullable(),
        }),
      ),
      /** Why the last answered problems were picked. */
      focus: z.object({
        answered: z.number().int().nonnegative(),
        mix: z.array(
          z.object({
            key: z.enum(focusKeys),
            count: z.number().int().positive(),
            /** The skills behind it, most often first. */
            skills: z.array(skillRef),
          }),
        ),
      }),
    }),
  ),
});
export type FamilyDashboard = z.infer<typeof familyDashboardSchema>;
