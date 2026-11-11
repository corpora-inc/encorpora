/**
 * A demo class's term, written in bulk. Every practiced day is the production
 * planner and the misspecified learner (`simulate.ts`); the stored level is
 * the production estimator after those answers. Deterministic for a given
 * class and day. Every name is made up.
 */
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import type { PoolClient } from "pg";
import { DEFAULT_FRONTIER_POLICY } from "../../learning/frontier-policy.js";
import { DAY, type Persona } from "./personas.js";
import {
  runSimulation,
  type SimActive,
  type SimAnswer,
  type SimHelp,
  type SimJob,
  type Simulation,
} from "./simulate.js";

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
 * for the caller, who sums them once. */
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
    /** Unused. Kept so older callers still type-check. Gaps are not forced. */
    recentDays?: number;
    sharedGap?: { people: readonly string[]; template: string } | null;
    stuck?: { person: string; template: string } | null;
  },
) {
  const model = options.model ?? "dose";
  const jobs: SimJob[] = options.students.map((student) => {
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
            learnerId: student.learnerId,
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
            learnerId: student.learnerId,
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
  const simulated = await simulateJobs(jobs);
  const answers: SimAnswer[] = [];
  const active: SimActive[] = [];
  const help: SimHelp[] = [];
  const levels: { learnerId: string; day: string; frontier: string }[] = [];
  for (const row of simulated) {
    answers.push(...row.answers);
    active.push(...row.active);
    help.push(...row.help);
    levels.push(...row.levels);
  }
  answers.sort(
    (a, b) =>
      a.at.localeCompare(b.at) || a.instanceId.localeCompare(b.instanceId),
  );
  await client.query("SET LOCAL statement_timeout='180s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout='0'");
  await insertChunks(client, active, 2000, (slice) =>
    client.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       SELECT l,d::date,s,k,m FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::bigint[]) AS t(l,d,s,k,m)
       ON CONFLICT DO NOTHING`,
      [
        slice.map((row) => row.learnerId),
        slice.map((row) => row.day),
        slice.map((row) => row.surface),
        slice.map((row) => row.skillId),
        slice.map((row) => row.ms),
      ],
    ),
  );
  await insertChunks(client, levels, 1000, (slice) =>
    client.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
       SELECT l,d::date,f::jsonb,$4 FROM unnest($1::text[],$2::text[],$3::text[]) AS t(l,d,f)
       ON CONFLICT DO NOTHING`,
      [
        slice.map((row) => row.learnerId),
        slice.map((row) => row.day),
        slice.map((row) => row.frontier),
        DEFAULT_FRONTIER_POLICY.version,
      ],
    ),
  );
  await insertChunks(client, answers, 400, (slice) =>
    client.query(
      `INSERT INTO amp_instances(id,learner_id,content,created_at)
       SELECT i,l,c::jsonb,a::timestamptz-interval '40 seconds'
       FROM unnest($1::text[],$2::text[],$3::text[],$4::text[]) AS t(i,l,c,a)`,
      [
        slice.map((row) => row.instanceId),
        slice.map((row) => row.learnerId),
        slice.map((row) => row.content),
        slice.map((row) => row.at),
      ],
    ),
  );
  await insertChunks(client, answers, 400, (slice) =>
    client.query(
      `INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at)
       SELECT o::jsonb->>'id',l,i,o::jsonb->>'requestId',o::jsonb,a::timestamptz
       FROM unnest($1::text[],$2::text[],$3::text[],$4::text[]) AS t(l,i,o,a)`,
      [
        slice.map((row) => row.learnerId),
        slice.map((row) => row.instanceId),
        slice.map((row) => row.outcome),
        slice.map((row) => row.at),
      ],
    ),
  );
  await insertChunks(client, help, 2000, (slice) =>
    client.query(
      `INSERT INTO amp_help_events(learner_id,"at",day,kind,source,skill_id,ref,problem_id,step)
       SELECT l,a::timestamptz,d::date,k::amp_help_kind,'practice',s,r,p,t
       FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::smallint[])
         AS t(l,a,d,k,s,r,p,t)`,
      [
        slice.map((row) => row.learnerId),
        slice.map((row) => row.at),
        slice.map((row) => row.day),
        slice.map((row) => row.kind),
        slice.map((row) => row.skillId),
        slice.map((row) => row.ref),
        slice.map((row) => row.problemId),
        slice.map((row) => row.step),
      ],
    ),
  );
  return { answers: answers.length, days: active.length };
}

export async function simulateJobs(jobs: readonly SimJob[]): Promise<Simulation[]> {
  if (jobs.length < 8) return jobs.map((job) => runSimulation(job));
  const workers = Math.max(
    2,
    Math.min(jobs.length, 8, availableParallelism()),
  );
  const execArgv = process.execArgv.filter(
    (arg) => arg !== "--test" && !arg.startsWith("--test-"),
  );
  const pool = Array.from(
    { length: workers },
    () => new Worker(new URL("./simulate.ts", import.meta.url), { execArgv }),
  );
  const results: Simulation[] = new Array(jobs.length);
  let cursor = 0;
  try {
    await Promise.all(
      pool.map(async (worker) => {
        for (;;) {
          const index = cursor;
          cursor += 1;
          const job = jobs[index];
          if (!job) return;
          results[index] = await ask(worker, job);
        }
      }),
    );
  } finally {
    await Promise.all(pool.map((worker) => worker.terminate()));
  }
  return results;
}

async function ask(
  worker: Worker,
  job: SimJob,
): Promise<Simulation> {
  const response = await new Promise<
    { ok: true; result: Simulation } | { ok: false; error: string }
  >((resolve, reject) => {
    const fail = (error: Error) => {
      worker.off("message", done);
      reject(error);
    };
    const done = (
      message: { ok: true; result: Simulation } | { ok: false; error: string },
    ) => {
      worker.off("error", fail);
      resolve(message);
    };
    worker.once("error", fail);
    worker.once("message", done);
    worker.postMessage(job);
  });
  if (!response.ok) throw new Error(response.error);
  return response.result;
}

async function insertChunks<T>(
  _client: Pick<PoolClient, "query">,
  rows: readonly T[],
  size: number,
  write: (slice: readonly T[]) => Promise<unknown>,
) {
  for (let index = 0; index < rows.length; index += size)
    await write(rows.slice(index, index + size));
}
