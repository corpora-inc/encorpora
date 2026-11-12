/**
 * A demo class's term simulated now and written (`history.ts`): for scripts,
 * fixtures and tests only (`scripts/design-personas.ts`). It runs the planner
 * and the estimator over every answer on worker threads, so the API never
 * imports it: the server writes only the shipped terms (`snapshot.ts`).
 * Deterministic for a given class and day. Every name is made up.
 */
import type { PoolClient } from "pg";
import { writeClassHistory } from "./history.js";
import { DAY, type Persona } from "./personas.js";
import type { SimJob, Simulation } from "./simulate.js";
import { simulateJobs } from "./simulate-pool.js";

export type DemoStudent = {
  personId: string;
  learnerId: string;
  persona: Persona;
  /** Roster grade. Falls back to `gradeLevel` on the call. */
  grade?: number;
};

const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Writes a demo class's term. Roster rows exist already, so the answer
 * triggers build skill days in the school's zone. Week rollups stay deferred
 * for the caller, who sums them once. `simulations`, when given, are the
 * students' terms already computed for these options, in student order. */
export async function seedClassHistory(
  client: Pick<PoolClient, "query">,
  options: {
    students: readonly DemoStudent[];
    timezone: string;
    termStart: string;
    /** Today in the school's zone. */
    today: string;
    gradeLevel: number;
    weekShape: readonly number[];
    /** The clock: today's answers were given in the last sitting. */
    now: number;
    /** The school day has begun in the school's zone. */
    workToday: boolean;
    /** `dose` is a demo class. `persona` is a family or adult fixture. */
    model?: "dose" | "persona";
    simulations?: readonly Simulation[];
    /** Unused. Kept so older callers still type-check. Gaps are not forced. */
    recentDays?: number;
    sharedGap?: { people: readonly string[]; template: string } | null;
    stuck?: { person: string; template: string } | null;
  },
) {
  const simulated =
    options.simulations ?? (await simulateJobs(historyJobs(options)));
  if (simulated.length !== options.students.length)
    throw new Error("One simulated term is needed for each student");
  return writeClassHistory(
    client,
    options.students.map((student) => student.learnerId),
    simulated,
  );
}

/** The simulation jobs for `seedClassHistory`'s students, in their order. */
export function historyJobs(options: {
  students: readonly DemoStudent[];
  termStart: string;
  today: string;
  gradeLevel: number;
  weekShape: readonly number[];
  now: number;
  workToday: boolean;
  model?: "dose" | "persona";
}): SimJob[] {
  const model = options.model ?? "dose";
  return options.students.map((student) => {
    const grade = student.grade ?? options.gradeLevel;
    const name = student.persona.name.join(" ");
    const joined =
      student.persona.joined === undefined
        ? undefined
        : iso(
            Date.parse(`${options.today}T12:00:00Z`) -
              student.persona.joined * DAY,
          );
    return model === "persona"
      ? {
          kind: "persona" as const,
          options: {
            name,
            grade,
            persona: student.persona,
            termStart: options.termStart,
            today: options.today,
            weekShape: options.weekShape,
            now: options.now,
            workToday: options.workToday,
          },
        }
      : {
          kind: "dose" as const,
          options: {
            name,
            grade,
            termStart: options.termStart,
            today: options.today,
            weekShape: options.weekShape,
            now: options.now,
            workToday: options.workToday,
            joined,
          },
        };
  });
}
