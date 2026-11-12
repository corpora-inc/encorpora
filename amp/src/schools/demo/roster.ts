/**
 * Who is in a demo place and what day it is there: everything a demo's
 * simulated term depends on, as pure functions of the kind, the zone and the
 * clock. The same inputs give the same jobs, so a term computed once serves
 * every demo made that day (`snapshot.ts`).
 */
import { namePairs } from "./names.js";
import {
  DAY,
  GRADE_5_CLASS,
  hash,
  persona,
  type Persona,
} from "./personas.js";
import type { SimJob } from "./simulate.js";
import { iso, SHORT_LAST_WEEK, termStartFor } from "./term.js";

export const demoKinds = ["class", "school"] as const;
export type DemoKind = (typeof demoKinds)[number];

export const SCHOOL_NAME = "Brightwater Elementary";
export const HERO = { name: "Grade 5 Math", grade: 5 };
/** The other classes of a demo school: who teaches them is only a name. */
const SCHOOL_CLASSES = [
  { name: "Grade 1 Math", grade: 1, teacher: 0, size: 21 },
  { name: "Grade 2 Math", grade: 2, teacher: 0, size: 23 },
  { name: "Grade 3 Math", grade: 3, teacher: 1, size: 22 },
  { name: "Grade 4 Math", grade: 4, teacher: 1, size: 25 },
  { name: "Grade 6 Math", grade: 6, teacher: 2, size: 24 },
] as const;

export type DemoClass = {
  name: string;
  grade: number;
  /** Index into the demo teachers; null is the owner's own class. */
  teacher: number | null;
  personas: readonly Persona[];
};

/** A demo's classes, the owner's hero class first. */
export function demoRoster(kind: DemoKind): DemoClass[] {
  const classes: DemoClass[] = [
    { ...HERO, teacher: null, personas: GRADE_5_CLASS },
  ];
  if (kind !== "school") return classes;
  const taken = new Set(GRADE_5_CLASS.map((entry) => entry.name.join(" ")));
  let offset = 3;
  for (const klass of SCHOOL_CLASSES) {
    const names = namePairs(klass.size, offset, taken);
    offset += klass.size * 5;
    for (const name of names) taken.add(name.join(" "));
    classes.push({
      name: klass.name,
      grade: klass.grade,
      teacher: klass.teacher,
      personas: names.map(([given, family], index) =>
        persona(
          given,
          family,
          klass.grade + (hash(`${given}${family}`) - 0.55) * 1.8,
          { identifier: `S-${20410 + offset + index}` },
        ),
      ),
    });
  }
  return classes;
}

/** The school day begins at this hour: before it, nobody has practiced today. */
export const SCHOOL_DAY_HOUR = 9;

export type DemoDay = {
  timezone: string;
  /** Today in the school's zone. */
  today: string;
  /** The term's first Monday: twelve weeks before this (UTC) week's. */
  termStart: string;
  /** The school day has begun in the school's zone. */
  workToday: boolean;
  /** When today's sitting ended: the school day's start, so a demo made at
   * any later hour of the day has the same term. */
  sittingEnd: number;
};

const parts = (time: number, timezone: string) => {
  const fields = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(time)
      .map((part) => [part.type, part.value]),
  );
  return {
    day: `${fields.year}-${fields.month}-${fields.day}`,
    hour: Number(fields.hour),
    minute: Number(fields.minute),
  };
};

/** The instant a wall clock in `timezone` reads `hour`:00 on `day`. */
export function zonedInstant(day: string, hour: number, timezone: string) {
  const wall = Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
  let time = wall;
  // Two corrections settle the zone's offset, daylight saving included.
  for (let step = 0; step < 2; step++) {
    const seen = parts(time, timezone);
    const shown = Date.parse(
      `${seen.day}T${String(seen.hour).padStart(2, "0")}:${String(seen.minute).padStart(2, "0")}:00Z`,
    );
    time += wall - shown;
  }
  return time;
}

/** What day it is for a demo made at `now` in `timezone`. */
export function demoDay(now: number, timezone: string): DemoDay {
  const local = parts(now, timezone);
  const workToday = local.hour >= SCHOOL_DAY_HOUR;
  return {
    timezone,
    today: local.day,
    termStart: iso(termStartFor(now)),
    workToday,
    sittingEnd: zonedInstant(
      local.day,
      workToday ? SCHOOL_DAY_HOUR : 0,
      timezone,
    ),
  };
}

/* The shared demo school is static: the same students, answers and levels
   every day, so someone presenting it can know them by heart. Its term is
   computed once, at a fixed anchor week, for each weekday (a Tuesday's term
   has Tuesday's sitting), and written each night with every date moved by
   whole weeks so it ends on the zone's today. The anchor is in New York
   during standard time, so its clock is UTC-5 throughout (`anchorWall`). */
export const ANCHOR_MONDAY = "2026-02-02";
export const ANCHOR_ZONE = "America/New_York";
/** New York's offset from UTC through the anchor term (EST). */
export const ANCHOR_OFFSET_MS = -5 * 3_600_000;

const weekdayOf = (day: string) =>
  (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;

/** The anchor day of weekday `weekday` (0 is Monday): the school day under
 * way in New York, so its sitting is done. */
export function variantDay(weekday: number): DemoDay {
  const today = iso(Date.parse(`${ANCHOR_MONDAY}T12:00:00Z`) + weekday * DAY);
  return demoDay(zonedInstant(today, 12, ANCHOR_ZONE), ANCHOR_ZONE);
}

/** The shared school a zone shows on its day at `now`: today's, from the
 * anchor variant of today's weekday, moved by `shiftDays` (whole weeks). */
export function sharedDay(now: number, timezone: string) {
  const day = parts(now, timezone).day;
  const weekday = weekdayOf(day);
  const shiftDays = Math.round(
    (Date.parse(`${day}T12:00:00Z`) -
      Date.parse(`${variantDay(weekday).today}T12:00:00Z`)) /
      DAY,
  );
  return { timezone, day, weekday, shiftDays };
}
export type SharedDay = ReturnType<typeof sharedDay>;

/** The day a student who joined `daysAgo` days before today joined. */
export const joinedOn = (today: string, daysAgo: number) =>
  iso(Date.parse(`${today}T12:00:00Z`) - daysAgo * DAY);

/** One simulation job per student of `classes`, in roster order. */
export function demoJobs(
  classes: readonly DemoClass[],
  day: Pick<DemoDay, "today" | "termStart" | "workToday" | "sittingEnd">,
): SimJob[] {
  return classes.flatMap((klass) =>
    klass.personas.map(
      (entry): SimJob => ({
        kind: "dose",
        options: {
          name: entry.name.join(" "),
          grade: klass.grade,
          termStart: day.termStart,
          today: day.today,
          weekShape: SHORT_LAST_WEEK,
          now: day.sittingEnd,
          workToday: day.workToday,
          joined:
            entry.joined === undefined
              ? undefined
              : joinedOn(day.today, entry.joined),
        },
      }),
    ),
  );
}
