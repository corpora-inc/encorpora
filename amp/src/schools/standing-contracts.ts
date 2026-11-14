import { z } from "zod";
import { orgKinds } from "./contracts.js";

const count = z.number().int().min(0);

/** An evenly spaced axis in grades from a student's own: `from`, `from +
 * step`, … `to`. Every curve in one response shares it. */
export const standingGrid = z.object({
  from: z.number(),
  to: z.number(),
  step: z.number().positive(),
});

/** A median with its 95% interval. */
export const interval = z.object({
  median: z.number(),
  low: z.number(),
  high: z.number(),
});

/** A group's curve: the even mixture of its students' N(μ, σ²), in grades from
 * their own, with the numbers it's read by. */
export const standingCurve = z.object({
  n: count,
  /** The median of the students' estimates; the curve's mean, and its sd:
   * spread between students plus each one's uncertainty. Null when empty. */
  median: z.number().nullable(),
  mean: z.number().nullable(),
  sd: z.number().nullable(),
  /** That median with where it sits (95%), from resampling the students and
   * drawing each from their own curve. */
  middle: interval.nullable(),
  /** Students whose curve stands on fewer than `settleAt` answers. */
  settling: count,
  /** Expected students behind (below −½), within (−½ to +½) and ahead of
   * their own grade: each student's curve counted where its mass falls. */
  behind: z.number(),
  within: z.number(),
  ahead: z.number(),
  /** Density on the response's grid, integrating to 1. */
  density: z.array(z.number()),
  /** The same students' grades drawn at the typical national within-grade
   * spread (`norms-prior.ts`), centred on their own grade: a reference. */
  typical: z.array(z.number()),
});

export const standingGroup = z.object({
  id: z.uuid(),
  name: z.string(),
  /** A school's groups are its classes; a district's are its schools. */
  kind: z.enum(["class", "school"]),
  /** The rostered grades in it, lowest first. */
  grades: z.array(z.number().int()),
  curve: standingCurve,
});

export const orgStandingResponse = z.object({
  org: z.object({ id: z.uuid(), name: z.string(), kind: z.enum(orgKinds) }),
  settleAt: count,
  grid: standingGrid,
  /** Every rostered student here, once. */
  all: standingCurve,
  grades: z.array(z.number().int()),
  groups: z.array(standingGroup),
});
export type OrgStandingResponse = z.infer<typeof orgStandingResponse>;
export type StandingCurve = z.infer<typeof standingCurve>;
export type StandingGroup = z.infer<typeof standingGroup>;
export type StandingGrid = z.infer<typeof standingGrid>;

export const standingStudent = z.object({
  /** The person, for their page. */
  id: z.uuid(),
  name: z.string(),
  grade: z.number().int().nullable(),
  /** Grades from their own grade, and its sd. */
  mu: z.number(),
  sd: z.number(),
  /** Answers the estimate stands on; 0 is the starting guess. */
  answered: count,
  /** This term's change, Δμ with σ = √(σ_start² + σ_end²); null before a
   * placed start. */
  growth: z.object({ mu: z.number(), sd: z.number() }).nullable(),
});
export const classStandingResponse = z.object({
  class: z.object({ id: z.uuid(), name: z.string(), org: z.uuid() }),
  term: z.object({ name: z.string(), startsOn: z.string(), endsOn: z.string() }),
  settleAt: count,
  grid: standingGrid,
  grades: z.array(z.number().int()),
  curve: standingCurve,
  /** The class's median growth this term, with its 95% interval, over `n`
   * students placed at both ends. */
  growth: interval.extend({ n: count }).nullable(),
  students: z.array(standingStudent),
});
export type ClassStandingResponse = z.infer<typeof classStandingResponse>;
export type StandingStudent = z.infer<typeof standingStudent>;
