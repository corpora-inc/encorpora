/**
 * The one practice model for a demo class. A class has a weekly dose and a
 * weekday pattern. A student draws a starting level from the within-grade
 * spread, a personal pace around the dose, and growth that rises with the
 * hours they actually practice. Answers are not decided here.
 */
import { withinGradeSd } from "../norms-prior.js";
import { learnerNoise } from "./engine-levels.js";
import { DAY, hash, type Persona } from "./personas.js";

/** Mean minutes a week, spread across the school. Grade 3 is the quiet class. */
export const CLASS_DOSE_MINUTES: Readonly<Record<number, number>> = {
  1: 46,
  2: 64,
  3: 32,
  4: 96,
  5: 74,
  6: 55,
};
/** ISO weekdays (Monday = 1) the class usually meets. */
export const CLASS_WEEKDAYS: Readonly<Record<number, readonly number[]>> = {
  1: [1, 2, 4, 5],
  2: [1, 3, 4, 5],
  3: [1, 2, 3, 4],
  4: [1, 2, 3, 5],
  5: [1, 2, 3, 4],
  6: [2, 3, 4, 5],
};
/** The demo school's quiet class: little practice in the current week. */
export const QUIET_GRADE = 3;
/** Problems in one sitting. Active minutes stretch to the dose. */
export const PROBLEMS_PER_SITTING = 10;
/** Growth noise, in grades over the term. The slope on hours is 0.5. */
export const GROWTH_NOISE = 0.15;
const GROWTH_FLOOR = -0.1;

/** Starting level, in sd of the within-grade prior, for the Grade 5 story.
 * High enough that the estimator can place them above the course; still
 * inside the prior. */
const STORY_Z: Readonly<Record<string, number>> = {
  Priya: 0.9,
  Sam: 0.8,
};
/** A strand whose true level sits below that strand's easiest skill, so the
 * misses on Today are the learner model, not a script. */
const STORY_STRAND: Readonly<Record<string, readonly [string, number]>> = {
  Kai: ["operations", -2.4],
  Noor: ["fractions", -2.2],
  Diego: ["fractions", -2.1],
  Lena: ["fractions", -2.15],
  Jonah: ["fractions", -2.05],
};

export type Sitting = {
  day: string;
  week: number;
  /** 0 at the term's first day, 1 on today. */
  progress: number;
  /** Milliseconds of active time for each problem that day. */
  msEach: number;
  problems: number;
};

export type LearnerTruth = {
  startOffset: number;
  growth: number;
  hoursPerWeek: number;
  slip: number;
  guess: number;
  strandOffsets: Map<string, number>;
  sittings: Sitting[];
};

const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
/** Monday = 1 … Sunday = 7. */
const isoWeekday = (day: string) => {
  const dow = weekday(day);
  return dow === 0 ? 7 : dow;
};

export function unitGaussian(key: string): number {
  const u = Math.max(hash(`${key}:u`), 1e-12);
  const v = hash(`${key}:v`);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (value: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, value));

/** Growth over the term, in grades. Higher weekly hours, higher growth. */
export function growthFromHours(hoursPerWeek: number, noise: number): number {
  return Math.max(GROWTH_FLOOR, 0.15 + 0.5 * hoursPerWeek + noise);
}

type DaySlot = {
  day: string;
  ago: number;
  week: number;
  factor: number;
  current: boolean;
};

function slots(options: {
  termStart: string;
  today: string;
  weekShape: readonly number[];
  joined?: string;
}): DaySlot[] {
  const todayTime = Date.parse(`${options.today}T12:00:00Z`);
  const startTime = Date.parse(`${options.termStart}T12:00:00Z`);
  const span = Math.max(0, Math.round((todayTime - startTime) / DAY));
  const todayWeek = Math.floor((todayTime - startTime) / (7 * DAY));
  const shortWeek = options.weekShape.length - 2;
  const out: DaySlot[] = [];
  for (let ago = span; ago >= 0; ago--) {
    const time = todayTime - ago * DAY;
    const day = iso(time);
    const dow = weekday(day);
    if (dow === 0 || dow === 6) continue;
    if (options.joined && day < options.joined) continue;
    const week = Math.floor((time - startTime) / (7 * DAY));
    if (week === shortWeek && dow >= 4) continue;
    const factor =
      options.weekShape[Math.min(week, options.weekShape.length - 1)] ?? 1;
    out.push({
      day,
      ago,
      week,
      factor,
      current: week === todayWeek,
    });
  }
  return out;
}

function enrolledWeeks(termStart: string, today: string): number {
  const span =
    Math.round(
      (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${termStart}T12:00:00Z`)) /
        DAY,
    ) + 1;
  return Math.max(1, span / 7);
}

/** Which of the term's school days this student sits, and how long each
 * problem takes, so the term's mean minutes land on the dose. */
function sittingsFor(options: {
  name: string;
  grade: number;
  doseMinutes: number;
  multiplier: number;
  weekdays: readonly number[];
  termStart: string;
  today: string;
  weekShape: readonly number[];
  workToday: boolean;
  joined?: string;
  /** Persona fixtures honor a last-active gap. Dose classes do not. */
  lastActive?: number;
  problems: number;
}): Sitting[] {
  const name = options.name;
  const quiet = options.grade === QUIET_GRADE;
  const chosen = slots(options).filter((slot) => {
    if (!options.weekdays.includes(isoWeekday(slot.day))) return false;
    if (options.lastActive !== undefined && slot.ago < options.lastActive)
      return false;
    if (slot.ago === 0 && !options.workToday) return false;
    let chance = Math.min(0.98, 0.55 + 0.4 * slot.factor);
    if (quiet && slot.current) chance = 0.08;
    if (slot.ago === 0) chance *= 0.7;
    return hash(`${name}${slot.day} show`) < chance;
  });
  if (!chosen.length) return [];
  const weeks = enrolledWeeks(options.termStart, options.today);
  const targetMs =
    options.doseMinutes * options.multiplier * weeks * 60_000;
  const meanFactor =
    chosen.reduce((sum, slot) => sum + slot.factor, 0) / chosen.length;
  const problems = options.problems;
  const span = Math.max(
    1,
    Math.round(
      (Date.parse(`${options.today}T12:00:00Z`) -
        Date.parse(`${options.termStart}T12:00:00Z`)) /
        DAY,
    ),
  );
  return chosen.map((slot) => ({
    day: slot.day,
    week: slot.week,
    progress: (span - slot.ago) / span,
    problems,
    msEach: Math.max(
      30_000,
      Math.round(
        (targetMs * (slot.factor / meanFactor)) /
          (chosen.length * problems),
      ),
    ),
  }));
}

function offsetsFor(
  name: string,
  first: string,
  strands: readonly string[],
): Map<string, number> {
  const story = STORY_STRAND[first];
  const tight = first === "Priya" || first === "Sam";
  const offsets = new Map<string, number>();
  for (const strand of strands) {
    const width = tight ? 0.3 : 1.2;
    offsets.set(strand, (hash(`${name}${strand} strand`) - 0.5) * width);
  }
  if (story && strands.includes(story[0])) offsets.set(story[0], story[1]);
  return offsets;
}



/** A rostered student in a demo class. */
export function doseTruth(options: {
  name: string;
  grade: number;
  termStart: string;
  today: string;
  weekShape: readonly number[];
  strands: readonly string[];
  workToday: boolean;
  joined?: string;
}): LearnerTruth {
  const first = options.name.split(" ")[0] ?? options.name;
  // A class is tighter than the national within-grade prior. The full prior
  // makes the estimator's placement climb larger than a term of real growth,
  // and the growth figure then falls as students started higher.
  const sd = withinGradeSd(options.grade) * 0.6;
  const storyZ = STORY_Z[first];
  const startOffset =
    storyZ !== undefined
      ? storyZ * sd
      : clamp(unitGaussian(`${options.name} start`), -1.6, 1.6) * sd;
  const multiplier =
    (first === "Priya" || first === "Sam" ? 1.08 : 1) *
    (0.4 + 1.2 * hash(`${options.name} pace`));
  const dose = CLASS_DOSE_MINUTES[options.grade] ?? 60;
  const weekdays = CLASS_WEEKDAYS[options.grade] ?? [1, 3, 5];
  const planned = sittingsFor({
    ...options,
    doseMinutes: dose,
    multiplier,
    weekdays,
    problems: PROBLEMS_PER_SITTING,
  });
  const weeks = enrolledWeeks(options.termStart, options.today);
  const minutes =
    planned.reduce((sum, sitting) => sum + sitting.msEach * sitting.problems, 0) /
    60_000;
  const hoursPerWeek = minutes / 60 / weeks;
  const { slip, guess } = learnerNoise(options.name);
  return {
    startOffset,
    growth: growthFromHours(
      hoursPerWeek,
      unitGaussian(`${options.name} growth`) * GROWTH_NOISE,
    ),
    hoursPerWeek,
    slip,
    guess,
    strandOffsets: offsetsFor(options.name, first, options.strands),
    sittings: planned,
  };
}

/** A family or adult fixture: their persona's level and volume, the same
 * growth rule as a class, and real sittings. */
export function personaTruth(options: {
  name: string;
  grade: number;
  persona: Persona;
  termStart: string;
  today: string;
  weekShape: readonly number[];
  strands: readonly string[];
  workToday: boolean;
}): LearnerTruth {
  const every = Math.max(1, options.persona.every);
  const weekdays = [1, 2, 3, 4, 5].filter(
    (_, index) => index % every === 0 || every <= 2,
  );
  const dose = options.persona.minutes * Math.min(5, weekdays.length);
  const planned = sittingsFor({
    name: options.name,
    grade: options.grade,
    doseMinutes: Math.max(20, dose),
    multiplier: 0.85 + 0.3 * hash(`${options.name} pace`),
    weekdays: weekdays.length ? weekdays : [1, 3],
    termStart: options.termStart,
    today: options.today,
    weekShape: options.weekShape,
    workToday: options.workToday,
    joined:
      options.persona.joined === undefined
        ? undefined
        : iso(Date.parse(`${options.today}T12:00:00Z`) - options.persona.joined * DAY),
    lastActive: options.persona.lastActive,
    problems: clamp(
      4,
      Math.round(options.persona.answers / 24) || PROBLEMS_PER_SITTING,
      12,
    ),
  });
  const weeks = enrolledWeeks(options.termStart, options.today);
  const minutes =
    planned.reduce((sum, sitting) => sum + sitting.msEach * sitting.problems, 0) /
    60_000;
  const hoursPerWeek = minutes / 60 / weeks;
  const { slip, guess } = learnerNoise(options.name);
  return {
    startOffset: options.persona.ability - options.grade,
    growth: growthFromHours(
      hoursPerWeek,
      unitGaussian(`${options.name} growth`) * GROWTH_NOISE,
    ),
    hoursPerWeek,
    slip,
    guess,
    strandOffsets: offsetsFor(options.name, options.name.split(" ")[0] ?? "", options.strands),
    sittings: planned,
  };
}
