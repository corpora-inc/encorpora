/**
 * The shared demo school's terms ship with the image: one per weekday, made
 * once per generator version on a developer machine (`npm run demo:terms`,
 * `scripts/demo-terms.ts`) and checked in under `terms/`. Making one is the
 * production planner and estimator over every simulated answer
 * (`simulate.ts`): about six CPU seconds a student and hundreds of megabytes
 * a thread, so an API pod never does it, warm or cold. A pod only reads the
 * weekday's file when it writes a school (`shared.ts`), a few students at a time,
 * and lets it go.
 *
 * A term is static (`roster.ts`): a fixed anchor week, moved to the day it is
 * written for (`shift.ts`). Its key is `DEMO_TERM_VERSION` and a digest of
 * the jobs (who the students are and what day it is), so a roster change
 * without new terms is caught by the tests and, in a running pod, refused
 * with a logged error instead of being computed.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import {
  brotliCompress,
  brotliDecompress,
  brotliDecompressSync,
  constants,
} from "node:zlib";
import { SchoolError } from "../contracts.js";
import { demoJobs, demoRoster, variantDay, type DemoKind } from "./roster.js";
import type { SimJob } from "./simulate.js";
import type { Simulation } from "./term-rows.js";

/** Bump when the demo's model or roster changes what a job's term is, then
 * run `npm run demo:terms`. Engine releases need not: a shipped term is the
 * planner's and estimator's own output when it was made, as a real
 * student's history is. */
export const DEMO_TERM_VERSION = 2;
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function snapshotKey(
  kind: DemoKind,
  weekday: number,
  jobs: readonly SimJob[],
) {
  const digest = createHash("sha256")
    .update(JSON.stringify({ version: DEMO_TERM_VERSION, jobs }))
    .digest("hex")
    .slice(0, 32);
  return `${kind}:v${DEMO_TERM_VERSION}:w${weekday}:${digest}`;
}

/** The jobs of weekday `weekday`'s anchor term (0 is Monday). */
export const variantJobs = (kind: DemoKind, weekday: number) =>
  demoJobs(demoRoster(kind), variantDay(weekday));

/** The school's terms are shipped; a class is the school's first class. */
export const shippedKey = (weekday: number) =>
  snapshotKey("school", weekday, variantJobs("school", weekday));

// Compiled, this file is inside src/server/main.mjs (`build:server`), and
// the terms stay beside the source.
export const TERMS_DIR = new URL(
  import.meta.url.endsWith(".mjs") ? "../schools/demo/terms/" : "./terms/",
  import.meta.url,
);
export const MANIFEST = "manifest.json";
export const termFile = (weekday: number) => `school-w${weekday}.json.br`;

export type Manifest = {
  /** The file encoding (`encodeTerms`). */
  version: number;
  weekdays: {
    weekday: number;
    key: string;
    bytes: number;
    sha256: string;
    /** Decompressed, so a pod reads it into one buffer of this size. */
    textBytes: number;
  }[];
};

const brotli = promisify(brotliCompress);

/** Encoding 2: brotli over lines, so a pod never holds a term file as one
 * string. A header, then each distinct problem and outcome text once (a
 * term's answers repeat them), then one line per student's term with its
 * answers pointing into those texts. A pod parses a student's line only when
 * it writes that student (`shippedTerms`). */
const ENCODING = 2;
type Header = { encoding: typeof ENCODING; strings: number; terms: number };
type AnswerRow = [
  serial: number,
  content: number,
  outcome: number,
  at: string,
  day: string,
  skillId: string,
  templateId: string,
  correct: 0 | 1,
  assisted: 0 | 1,
];
type PackedTerm = Omit<Simulation, "answers"> & { answers: AnswerRow[] };

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
  const packed = terms.map((term): PackedTerm => ({
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
  }));
  const header: Header = {
    encoding: ENCODING,
    strings: strings.length,
    terms: packed.length,
  };
  // JSON never contains a raw newline, so each line is one value.
  const lines = [header, ...strings, ...packed].map(
    (value) => JSON.stringify(value) + "\n",
  );
  const text = Buffer.from(lines.join(""));
  return brotli(text, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_LGWIN]: 24,
      [constants.BROTLI_PARAM_SIZE_HINT]: text.length,
    },
  });
}

/** A school's terms as shipped: each student's term parsed when asked for.
 * The problem and outcome texts are shared by every term it gives. */
export type TermSource = {
  readonly length: number;
  slice(from: number, to: number): Simulation[];
};

const unbrotli = promisify(brotliDecompress);

/** Decompresses a term file off the event loop into one buffer: an output
 * chunk larger than its known size means one allocation, no chunks to copy
 * and leave behind, freed as one when the write is done. */
async function decompress(payload: Buffer, size: number) {
  const text = await unbrotli(payload, { chunkSize: size + 1024 });
  if (text.length !== size)
    throw new Error("A demo term file is not the size its manifest says");
  return text;
}

/** A term file's text (encoding 2) as line offsets: a text is parsed only
 * when a student who answered it is written, and a student's term only when
 * it is asked for. */
export function openTerms(text: Buffer): TermSource {
  const ends: number[] = [];
  for (let end = text.indexOf(10); end >= 0; end = text.indexOf(10, end + 1))
    ends.push(end);
  const line = (index: number) =>
    text.toString("utf8", index ? ends[index - 1]! + 1 : 0, ends[index]);
  const header = JSON.parse(line(0)) as Header;
  if (header.encoding !== ENCODING)
    throw new Error("Unknown demo term encoding");
  if (
    ends.length !== 1 + header.strings + header.terms ||
    ends.at(-1) !== text.length - 1
  )
    throw new Error("A demo term file is incomplete");
  const term = (index: number, texts: Map<number, string>): Simulation => {
    const string = (ref: number) => {
      let found = texts.get(ref);
      if (found === undefined) {
        found = JSON.parse(line(1 + ref)) as string;
        texts.set(ref, found);
      }
      return found;
    };
    const packed = JSON.parse(line(1 + header.strings + index)) as PackedTerm;
    return {
      ...packed,
      answers: packed.answers.map(
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
          content: string(content),
          outcome: string(outcome),
          at,
          day,
          skillId,
          templateId,
          correct: correct === 1,
          assisted: assisted === 1,
        }),
      ),
    };
  };
  return {
    length: header.terms,
    slice: (from, to) => {
      // Terms given together share their texts.
      const texts = new Map<number, string>();
      const indexes: number[] = [];
      for (
        let index = Math.max(0, from);
        index < Math.min(to, header.terms);
        index++
      )
        indexes.push(index);
      return indexes.map((index) => term(index, texts));
    },
  };
}

/** Every term of a file at once: for scripts and tests. */
export function decodeTerms(payload: Buffer): Simulation[] {
  const source = openTerms(brotliDecompressSync(payload));
  return source.slice(0, source.length);
}

export const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

export function readManifest(dir: URL = TERMS_DIR): Manifest | null {
  try {
    return JSON.parse(readFileSync(new URL(MANIFEST, dir), "utf8"));
  } catch {
    return null;
  }
}

/** Why weekday `weekday`'s shipped term can't be used, or its bytes. */
function shipped(
  weekday: number,
  dir: URL,
): { bytes: Buffer; textBytes: number } | { problem: string } {
  const manifest = readManifest(dir);
  if (manifest && manifest.version !== ENCODING)
    return {
      problem: `terms of encoding ${manifest.version}, not ${ENCODING}`,
    };
  const entry = manifest?.weekdays.find((row) => row.weekday === weekday);
  if (!entry) return { problem: "no shipped term for this weekday" };
  if (entry.key !== shippedKey(weekday))
    return {
      problem: `shipped term ${entry.key} is not ${shippedKey(weekday)}`,
    };
  let bytes: Buffer;
  try {
    bytes = readFileSync(new URL(termFile(weekday), dir));
  } catch {
    return { problem: `${termFile(weekday)} is missing` };
  }
  if (sha256(bytes) !== entry.sha256)
    return { problem: `${termFile(weekday)} does not match its manifest` };
  return { bytes, textBytes: entry.textBytes };
}

/** Every weekday's shipped term is there and current: null, or what is
 * wrong. Cheap (a few milliseconds), so the server checks it at boot. */
export function shippedTermsProblem(dir: URL = TERMS_DIR): string | null {
  const problems = WEEKDAYS.flatMap((weekday) => {
    const found = shipped(weekday, dir);
    return "problem" in found ? [`w${weekday}: ${found.problem}`] : [];
  });
  return problems.length ? problems.join("; ") : null;
}

/** The anchor terms of a demo of `kind` for weekday `weekday` (0 is Monday),
 * one per student in roster order, read from the image as they are written
 * (`TermSource`). `shift.ts` moves them to a day. Without a current shipped
 * term (a build that left it out, or a roster change without `npm run
 * demo:terms`) it fails with a logged error and "the demo is being
 * prepared"; it never simulates one. */
export async function shippedTerms(
  kind: DemoKind,
  weekday: number,
  dir: URL = TERMS_DIR,
): Promise<TermSource> {
  const found = shipped(weekday, dir);
  if ("problem" in found) {
    console.error(
      JSON.stringify({
        demoTermsMissing: found.problem,
        weekday,
        key: shippedKey(weekday),
      }),
    );
    throw new SchoolError(503, "demo_preparing", 300);
  }
  const terms = openTerms(await decompress(found.bytes, found.textBytes));
  if (kind === "school") return terms;
  // A class is the school's first class: the same students on the same day.
  const jobs = variantJobs(kind, weekday);
  const school = variantJobs("school", weekday);
  if (
    JSON.stringify(school.slice(0, jobs.length)) !== JSON.stringify(jobs) ||
    terms.length !== school.length
  )
    throw new Error("A demo class is no longer the school's first class");
  return {
    length: jobs.length,
    slice: (from, to) =>
      terms.slice(Math.min(from, jobs.length), Math.min(to, jobs.length)),
  };
}

/** Every term at once (`shippedTerms`): for fixtures, scripts and tests. */
export async function demoTerms(
  kind: DemoKind,
  weekday: number,
  dir: URL = TERMS_DIR,
): Promise<Simulation[]> {
  const terms = await shippedTerms(kind, weekday, dir);
  return terms.slice(0, terms.length);
}
