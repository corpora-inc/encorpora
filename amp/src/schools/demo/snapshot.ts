/**
 * A demo's term, computed once a day and written for every demo made that
 * day. The term is the production planner and estimator over every simulated
 * answer (`simulate.ts`): about eight CPU seconds a student, so a school is
 * minutes. It depends only on the jobs (`roster.ts`), never on who asked, so
 * it is computed ahead of the day on worker threads, kept in memory, and
 * shared between pods in `amp_demo_snapshots`. One pod computes a key; the
 * others read it. A request that finds no term waits for the one being
 * computed instead of starting another.
 */
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import type { Pool } from "pg";
import { SchoolError } from "../contracts.js";
import {
  demoDay,
  demoJobs,
  demoRoster,
  type DemoDay,
  type DemoKind,
} from "./roster.js";
import type { SimJob, Simulation } from "./simulate.js";
import { simulateJobs } from "./simulate-pool.js";

/** Bump when the demo's model changes what a job's term is, so no pod reuses
 * a term from before. Engine releases need not: a stored term is the
 * planner's and estimator's own output on the day it was made, as a real
 * student's history is. */
export const DEMO_TERM_VERSION = 1;
/** A claimed key that has not been written by then is free to claim again. */
const CLAIM_SECONDS = 600;
/** How long a request waits for a term being computed. */
const WAIT_MS = 175_000;
const KEEP_DAYS = 3;

export function snapshotKey(kind: DemoKind, jobs: readonly SimJob[]) {
  const digest = createHash("sha256")
    .update(JSON.stringify({ version: DEMO_TERM_VERSION, jobs }))
    .digest("hex")
    .slice(0, 32);
  const day = jobs[0]?.options.today ?? "none";
  return `${kind}:${day}:${digest}`;
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
/** Terms in this process, newest last: today's and the next few. */
const memory = new Map<string, Promise<Simulation[]>>();
/** Forgets the terms this process holds, as a new pod would start. */
export const forgetDemoTerms = () => memory.clear();
const MEMORY_KEYS = 6;
const owner = randomUUID();

/** The terms of a demo of `kind` made on `day`, one per student in roster
 * order: from memory, from another pod, or computed here. */
export function demoTerms(
  pool: Pool,
  kind: DemoKind,
  day: DemoDay,
): Promise<Simulation[]> {
  const jobs = demoJobs(demoRoster(kind), day);
  const key = snapshotKey(kind, jobs);
  const known = memory.get(key);
  if (known) return known;
  const loading = loadOrCompute(pool, key, kind, day, jobs);
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
  day: DemoDay,
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
    if (claimed.rowCount) return compute(pool, key, kind, day, jobs);
    if (Date.now() > deadline)
      throw new SchoolError(503, "school_service_unavailable", 30);
    await delay(1_000);
  }
}

async function compute(
  pool: Pool,
  key: string,
  kind: DemoKind,
  day: DemoDay,
  jobs: readonly SimJob[],
): Promise<Simulation[]> {
  try {
    // A class is the school's first class: a school's terms give it too.
    const school =
      kind === "class"
        ? await schoolTerms(day, jobs).catch(() => null)
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

/** The school's terms for this day, if this process has them, cut to `jobs`. */
async function schoolTerms(day: DemoDay, jobs: readonly SimJob[]) {
  const schoolJobs = demoJobs(demoRoster("school"), day);
  const known = memory.get(snapshotKey("school", schoolJobs));
  if (!known) return null;
  const same =
    JSON.stringify(schoolJobs.slice(0, jobs.length)) === JSON.stringify(jobs);
  return same ? (await known).slice(0, jobs.length) : null;
}

/** The days a demo made in the next `ahead` ms would have, in each zone. */
export function upcomingDays(
  now: number,
  timezones: readonly string[],
  ahead = 3 * 3_600_000,
) {
  const days = new Map<string, DemoDay>();
  for (const timezone of timezones)
    for (let at = now; at <= now + ahead; at += 15 * 60_000) {
      const day = demoDay(at, timezone);
      days.set(JSON.stringify(day), day);
    }
  return [...days.values()];
}

/** Computes (or loads) every term a demo made soon would need: the school
 * first, so the class is cut from it. Removes terms older than a few days. */
export async function warmDemoTerms(
  pool: Pool,
  options: { now?: number; timezones?: readonly string[]; ahead?: number } = {},
) {
  const now = options.now ?? Date.now();
  const timezones = options.timezones ?? (await demoZones(pool));
  for (const day of upcomingDays(now, timezones, options.ahead))
    for (const kind of ["school", "class"] as const)
      await demoTerms(pool, kind, day);
  await pool.query(
    "DELETE FROM amp_demo_snapshots WHERE created_at<now()-make_interval(days=>$1)",
    [KEEP_DAYS],
  );
}

/** New York, and the zones of demos opened this week. */
async function demoZones(pool: Pool) {
  const { rows } = await pool.query<{ timezone: string }>(
    `SELECT timezone FROM amp_orgs WHERE demo AND demo_seen_at>now()-interval '7 days'
     GROUP BY timezone ORDER BY count(*) DESC LIMIT 4`,
  );
  return [
    ...new Set(["America/New_York", ...rows.map((row) => row.timezone)]),
  ];
}

type Log = {
  info: (details: object, message: string) => void;
  warn: (details: object, message: string) => void;
};

/** Keeps the terms warm on this pod: now, and every ten minutes, so the day's
 * next terms exist before a visitor needs them. */
export function startDemoWarmer(pool: Pool, log: Log) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    const started = performance.now();
    try {
      await warmDemoTerms(pool);
      const ms = Math.round(performance.now() - started);
      if (ms > 1_000) log.info({ ms }, "demo terms warmed");
    } catch (error) {
      log.warn(
        { reason: error instanceof Error ? error.message : "unknown" },
        "demo terms not warmed; a demo made now waits for them",
      );
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 10 * 60_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
