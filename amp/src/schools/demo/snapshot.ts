/**
 * The shared demo school's term, computed once per generator version. It is
 * the production planner and estimator over every simulated answer
 * (`simulate.ts`): about eight CPU seconds a student, so a school is minutes.
 * It is static (`roster.ts`): one term per weekday at a fixed anchor week,
 * moved to the day it is written for (`shift.ts`). So it is computed on worker
 * threads at most seven times a version, kept in memory, and shared between
 * pods and across deploys in `amp_demo_snapshots`. One pod computes a key; the
 * others read it. A request that finds no term waits for the one being
 * computed instead of starting another.
 */
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import type { Pool } from "pg";
import { SchoolError } from "../contracts.js";
import {
  demoJobs,
  demoRoster,
  variantDay,
  type DemoKind,
} from "./roster.js";
import type { SimJob, Simulation } from "./simulate.js";
import { simulateJobs } from "./simulate-pool.js";

/** Bump when the demo's model or roster changes what a job's term is, so no
 * pod reuses a term from before. Engine releases need not: a stored term is
 * the planner's and estimator's own output when it was made, as a real
 * student's history is. */
export const DEMO_TERM_VERSION = 2;
/** A claimed key that has not been written by then is free to claim again. */
const CLAIM_SECONDS = 600;
/** How long a request waits for a term being computed. */
const WAIT_MS = 175_000;
/** Terms of another version stay this long, for pods still running it. */
const KEEP_OTHER_VERSIONS_DAYS = 7;

const versionPrefix = (kind: DemoKind) => `${kind}:v${DEMO_TERM_VERSION}:`;

export function snapshotKey(
  kind: DemoKind,
  weekday: number,
  jobs: readonly SimJob[],
) {
  const digest = createHash("sha256")
    .update(JSON.stringify({ version: DEMO_TERM_VERSION, jobs }))
    .digest("hex")
    .slice(0, 32);
  return `${versionPrefix(kind)}w${weekday}:${digest}`;
}

const gzipped = promisify(gzip);
const gunzipped = promisify(gunzip);

type Packed = {
  version: 1;
  strings: string[];
  terms: (Omit<Simulation, "answers"> & {
    answers: [
      number,
      number,
      number,
      string,
      string,
      string,
      string,
      0 | 1,
      0 | 1,
    ][];
  })[];
};

/** A term's answers repeat their problem and outcome text: each is stored
 * once. Decoded terms share those strings. */
export async function encodeTerms(terms: readonly Simulation[]) {
  const index = new Map<string, number>();
  const strings: string[] = [];
  const ref = (text: string) => {
    let found = index.get(text);
    if (found === undefined) {
      found = strings.length;
      strings.push(text);
      index.set(text, found);
    }
    return found;
  };
  const packed: Packed = {
    version: 1,
    strings,
    terms: terms.map((term) => ({
      ...term,
      answers: term.answers.map((row) => [
        row.serial,
        ref(row.content),
        ref(row.outcome),
        row.at,
        row.day,
        row.skillId,
        row.templateId,
        row.correct ? 1 : 0,
        row.assisted ? 1 : 0,
      ]),
    })),
  };
  return gzipped(JSON.stringify(packed), { level: 6 });
}

export async function decodeTerms(payload: Buffer): Promise<Simulation[]> {
  const packed = JSON.parse(String(await gunzipped(payload))) as Packed;
  if (packed.version !== 1) throw new Error("Unknown demo term encoding");
  const { strings } = packed;
  return packed.terms.map((term) => ({
    ...term,
    answers: term.answers.map(
      ([
        serial,
        content,
        outcome,
        at,
        day,
        skillId,
        templateId,
        correct,
        assisted,
      ]) => ({
        serial,
        content: strings[content]!,
        outcome: strings[outcome]!,
        at,
        day,
        skillId,
        templateId,
        correct: correct === 1,
        assisted: assisted === 1,
      }),
    ),
  }));
}

const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));
/** Terms in this process, newest last: today's and tomorrow's. */
const memory = new Map<string, Promise<Simulation[]>>();
/** Forgets the terms this process holds, as a new pod would start. */
export const forgetDemoTerms = () => memory.clear();
const MEMORY_KEYS = 4;
const owner = randomUUID();

/** The jobs of weekday `weekday`'s anchor term (0 is Monday). */
export const variantJobs = (kind: DemoKind, weekday: number) =>
  demoJobs(demoRoster(kind), variantDay(weekday));

/** The anchor terms of a demo of `kind` for weekday `weekday` (0 is Monday),
 * one per student in roster order: from memory, from another pod, or
 * computed here. `shift.ts` moves them to a day. */
export function demoTerms(
  pool: Pool,
  kind: DemoKind,
  weekday: number,
): Promise<Simulation[]> {
  const jobs = variantJobs(kind, weekday);
  const key = snapshotKey(kind, weekday, jobs);
  const known = memory.get(key);
  if (known) {
    // Most recently used last, so eviction drops the oldest.
    memory.delete(key);
    memory.set(key, known);
    return known;
  }
  const loading = loadOrCompute(pool, key, kind, weekday, jobs);
  memory.set(key, loading);
  loading.catch(() => memory.delete(key));
  for (const old of memory.keys())
    if (memory.size > MEMORY_KEYS) memory.delete(old);
  return loading;
}

async function loadOrCompute(
  pool: Pool,
  key: string,
  kind: DemoKind,
  weekday: number,
  jobs: readonly SimJob[],
): Promise<Simulation[]> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const stored = (
      await pool.query<{ payload: Buffer }>(
        "SELECT payload FROM amp_demo_snapshots WHERE key=$1 AND payload IS NOT NULL",
        [key],
      )
    ).rows[0];
    if (stored) return decodeTerms(stored.payload);
    const claimed = await pool.query(
      `INSERT INTO amp_demo_snapshots(key,building_until) VALUES($1,now()+make_interval(secs=>$3))
       ON CONFLICT(key) DO UPDATE SET building_until=EXCLUDED.building_until
         WHERE amp_demo_snapshots.payload IS NULL
           AND (amp_demo_snapshots.building_until IS NULL OR amp_demo_snapshots.building_until<now())
       RETURNING $2::text AS owner`,
      [key, owner, CLAIM_SECONDS],
    );
    if (claimed.rowCount) return compute(pool, key, kind, weekday, jobs);
    if (Date.now() > deadline)
      throw new SchoolError(503, "school_service_unavailable", 30);
    await delay(1_000);
  }
}

async function compute(
  pool: Pool,
  key: string,
  kind: DemoKind,
  weekday: number,
  jobs: readonly SimJob[],
): Promise<Simulation[]> {
  try {
    // A class is the school's first class: a school's terms give it too.
    const school =
      kind === "class"
        ? await schoolTerms(weekday, jobs).catch(() => null)
        : null;
    const terms = school ?? (await simulateJobs(jobs));
    const payload = await encodeTerms(terms);
    await pool.query(
      "UPDATE amp_demo_snapshots SET payload=$2,built_at=now(),building_until=NULL WHERE key=$1",
      [key, payload],
    );
    // What every pod reads, so a term is the same from memory or not.
    return await decodeTerms(payload);
  } catch (error) {
    await pool
      .query(
        "UPDATE amp_demo_snapshots SET building_until=NULL WHERE key=$1 AND payload IS NULL",
        [key],
      )
      .catch(() => undefined);
    throw error;
  }
}

/** The school's terms for this weekday, if this process has them, cut to
 * `jobs`. */
async function schoolTerms(weekday: number, jobs: readonly SimJob[]) {
  const schoolJobs = variantJobs("school", weekday);
  const known = memory.get(snapshotKey("school", weekday, schoolJobs));
  if (!known) return null;
  const same =
    JSON.stringify(schoolJobs.slice(0, jobs.length)) === JSON.stringify(jobs);
  return same ? (await known).slice(0, jobs.length) : null;
}

/** Computes (or loads) the school's terms for these weekdays. Terms of other
 * versions go after a week. */
export async function warmDemoTerms(pool: Pool, weekdays: readonly number[]) {
  for (const weekday of new Set(weekdays))
    await demoTerms(pool, "school", weekday);
  await pool.query(
    `DELETE FROM amp_demo_snapshots WHERE NOT (key LIKE $1 OR key LIKE $2)
       AND created_at<now()-make_interval(days=>$3)`,
    [
      `${versionPrefix("school")}%`,
      `${versionPrefix("class")}%`,
      KEEP_OTHER_VERSIONS_DAYS,
    ],
  );
}
