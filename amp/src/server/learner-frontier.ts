import { createHash } from "node:crypto";
import {
  advanceFrontierState,
  createFrontierState,
  estimateFrontier,
  readFrontierState,
  STRAND_FREEZE,
  type Frontier,
  type FrontierCatalog,
  type FrontierFold,
  type FrontierFoldItem,
  type FrontierObservation,
  type FrontierState,
} from "../learning/frontier";
import { DEFAULT_FRONTIER_POLICY } from "../learning/frontier-policy";
import { skills } from "../curriculum/catalog";
import { guessChanceOf } from "../math/guess-chance";
import { templates } from "../math/engine";
import { historicalTemplates } from "../math/historical-templates";
import { templateGrade } from "./mixed-practice";

/**
 * A learner's level, kept so a request folds in only their newest answers. A
 * state is valid for one estimator, one set of catalog facts about the families
 * it has seen, one practice epoch and one set of strand starts. Anything else
 * discards it and replays the history once.
 */
export const CHECKPOINT_EVERY = 25;
/** Longer replays go to the worker so they can't stall the API. */
export const OFF_THREAD_ANSWERS = 300;
const STATE_FORMAT = 1;

const templateById = new Map(
  [...templates, ...historicalTemplates].map((t) => [t.id, t]),
);
const skillById = new Map(skills.map((s) => [s.id, s]));
const strandOfFamily = (id: string) =>
  skillById.get(templateById.get(id)?.skillId ?? "")?.strand;
/** The catalog's grades, strands and guessing chances. */
export const frontierCatalog: FrontierCatalog = {
  gradeOf: (id) => {
    const template = templateById.get(id);
    return template && templateGrade(template, skillById);
  },
  strandOf: (id) => strandOfFamily(id) ?? id,
  guessOf: guessChanceOf,
};

export type LearnerObservation = FrontierObservation & {
  practiceRevision: number;
  sequence: string;
};
export type StrandStarts = Record<string, { level: number; revision: number }>;
export type LearnerFrontierKey = {
  epoch: number;
  start: number;
  strandStarts: StrandStarts;
};
export type LearnerFrontierState = LearnerFrontierKey & {
  fingerprint: string;
  /** The newest answer folded in. Answers only ever append (`amp_attempts`). */
  sequence: string;
  main: FrontierState;
  /** A strand restarted from a chosen level counts only answers since then. */
  restarted: Record<string, FrontierState>;
  /** Every family answered, to notice a catalog change that affects them. */
  families: string[];
  signature: string;
};

let fingerprint: string | undefined;
/** Identifies what the estimator computes, by asking it: any change in its
 * logic or policy that changes a result here discards stored states. */
export function estimatorFingerprint() {
  if (fingerprint) return fingerprint;
  const family = (i: number) => `family-${i % 11}`;
  const probe = estimateFrontier({
    start: 5,
    now: 86400000 * 400,
    gradeOf: (id) => (Number(id.slice(7)) * 3) % 14,
    strandOf: (id) => `strand-${Number(id.slice(7)) % 3}`,
    guessOf: (id) => [0, 1 / 2, 1 / 4, 1 / 8][Number(id.slice(7)) % 4]!,
    observations: Array.from({ length: 160 }, (_, i) => ({
      templateId: family(i * 7),
      correct: (i * i) % 5 !== 0,
      assisted: i % 13 === 0,
      evidenceWeight: i % 17 === 0 ? 0.5 : 1,
      createdAt: new Date(i * i * 3600000).toISOString(),
    })),
  });
  fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        STATE_FORMAT,
        STRAND_FREEZE,
        DEFAULT_FRONTIER_POLICY,
        probe,
      ]),
    )
    .digest("hex")
    .slice(0, 16);
  return fingerprint;
}

const familyFacts = new Map<string, number>();
function factsOf(id: string) {
  let facts = familyFacts.get(id);
  if (facts === undefined) {
    const text = `${frontierCatalog.gradeOf(id)}|${frontierCatalog.strandOf(id)}|${strandOfFamily(id)}|${frontierCatalog.guessOf(id)}`;
    facts = createHash("sha256").update(text).digest().readUInt32LE(0);
    familyFacts.set(id, facts);
  }
  return facts;
}
/** Run on every read, so only arithmetic: a family added to the catalog doesn't
 * disturb learners who haven't seen it, and a family's new grade only learners
 * who have. */
function catalogSignature(families: readonly string[]) {
  let a = 0;
  let b = 0;
  for (const id of families) {
    const facts = factsOf(id);
    a = (Math.imul(a, 31) + facts) >>> 0;
    b = (Math.imul(b, 131) ^ facts) >>> 0;
  }
  return `${a.toString(36)}.${b.toString(36)}`;
}

export function newLearnerFrontier(
  key: LearnerFrontierKey,
): LearnerFrontierState {
  return {
    ...key,
    fingerprint: estimatorFingerprint(),
    sequence: "0",
    main: createFrontierState(key.start),
    restarted: Object.fromEntries(
      Object.entries(key.strandStarts).map(([strand, { level }]) => [
        strand,
        createFrontierState(level),
      ]),
    ),
    families: [],
    signature: catalogSignature([]),
  };
}

function sameStarts(a: StrandStarts, b: StrandStarts) {
  const names = Object.keys(a);
  return (
    names.length === Object.keys(b).length &&
    names.every(
      (name) =>
        a[name]!.level === b[name]?.level &&
        a[name]!.revision === b[name]?.revision,
    )
  );
}
export function isCurrentLearnerFrontier(
  state: LearnerFrontierState,
  key: LearnerFrontierKey,
) {
  return (
    state.fingerprint === estimatorFingerprint() &&
    state.epoch === key.epoch &&
    state.start === key.start &&
    sameStarts(state.strandStarts, key.strandStarts) &&
    state.signature === catalogSignature(state.families)
  );
}

export function advanceLearnerFrontier(
  state: LearnerFrontierState,
  observations: readonly LearnerObservation[],
) {
  const seen = new Set(state.families);
  const policy = DEFAULT_FRONTIER_POLICY;
  for (const observation of observations) {
    advanceFrontierState(
      state.main,
      observation,
      frontierCatalog,
      policy,
      STRAND_FREEZE,
    );
    const strand = strandOfFamily(observation.templateId);
    const restart = strand ? state.strandStarts[strand] : undefined;
    if (restart && observation.practiceRevision >= restart.revision)
      advanceFrontierState(
        state.restarted[strand!]!,
        observation,
        frontierCatalog,
        policy,
        STRAND_FREEZE,
      );
    if (!seen.has(observation.templateId)) {
      seen.add(observation.templateId);
      state.families.push(observation.templateId);
    }
    state.sequence = observation.sequence;
  }
  state.signature = catalogSignature(state.families);
  return state;
}

export function readLearnerFrontier(
  state: LearnerFrontierState,
  now: number,
): Frontier {
  const frontier = readFrontierState(state.main, now);
  for (const [strand, restarted] of Object.entries(state.restarted))
    applyStrandRestart(
      frontier,
      strand,
      state.strandStarts[strand]!.level,
      readFrontierState(restarted, now),
    );
  return frontier;
}

/** A restarted strand reads from its own estimate, not the learner's whole one. */
export function applyStrandRestart(
  frontier: Frontier,
  strand: string,
  level: number,
  local: Frontier,
) {
  frontier.strands[strand] = local.strands[strand] ?? local.overall;
  if (frontier.confirmation)
    frontier.confirmation[strand] = {
      ...(local.confirmation?.[strand] ?? {
        level: local.unconfirmedCeiling!,
        foundationConfirmed: false,
      }),
      foundationLevel: level,
    };
}

/** Folds answers into a stored state, or into a new one if there is none. */
export function updateLearnerFrontier(input: {
  stored: string | null;
  observations: readonly LearnerObservation[];
  key: LearnerFrontierKey;
}) {
  const state =
    (input.stored && decodeLearnerFrontier(input.stored)) ||
    newLearnerFrontier(input.key);
  return encodeLearnerFrontier(
    advanceLearnerFrontier(state, input.observations),
  );
}

// Stored compactly: a learner with a long history reads this on every request
// for problems, and each estimate holds a 141-point curve of doubles.
const encodeFold = (fold: FrontierFold) => [
  Buffer.from(new Float64Array(fold.log).buffer).toString("base64"),
  fold.previous,
  fold.surprise,
  fold.uncertainty,
  fold.answered,
  fold.independent,
];
function decodeFold(encoded: unknown[]): FrontierFold {
  const bytes = Buffer.from(encoded[0] as string, "base64");
  return {
    log: Array.from(
      new Float64Array(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
      ),
    ),
    previous: encoded[1] as number | null,
    surprise: encoded[2] as number,
    uncertainty: encoded[3] as number,
    answered: encoded[4] as number,
    independent: encoded[5] as number,
  };
}
const encodeItem = (item: FrontierFoldItem) => [
  item.grade,
  item.guess,
  item.success ? 1 : 0,
  item.assisted ? 1 : 0,
  item.at,
  item.weight,
];
const decodeItem = (encoded: number[]): FrontierFoldItem => ({
  grade: encoded[0]!,
  guess: encoded[1]!,
  success: encoded[2] === 1,
  assisted: encoded[3] === 1,
  at: encoded[4]!,
  weight: encoded[5]!,
});
// Family names repeat across a long history, so buckets name them by position.
const encodeConfirmation = (
  confirmation: FrontierState["confirmation"],
  position: ReadonlyMap<string, number>,
) =>
  Object.fromEntries(
    Object.entries(confirmation).map(([name, strand]) => [
      name,
      {
        seen: strand.seen,
        successes: strand.successes,
        buckets: strand.buckets.map((bucket) => ({
          grade: bucket.grade,
          success: bucket.success,
          items: bucket.items.map((item) => [
            position.get(item.templateId),
            item.at,
            item.order,
          ]),
        })),
      },
    ]),
  );
type EncodedConfirmation = ReturnType<typeof encodeConfirmation>;
const decodeConfirmation = (
  confirmation: EncodedConfirmation,
  families: readonly string[],
): FrontierState["confirmation"] =>
  Object.fromEntries(
    Object.entries(confirmation).map(([name, strand]) => [
      name,
      {
        seen: strand.seen,
        successes: strand.successes,
        buckets: strand.buckets.map((bucket) => ({
          grade: bucket.grade,
          success: bucket.success,
          items: (bucket.items as number[][]).map((item) => ({
            templateId: families[item[0]!]!,
            at: item[1]!,
            order: item[2]!,
          })),
        })),
      },
    ]),
  );
const encodeState = (
  state: FrontierState,
  position: ReadonlyMap<string, number>,
) => ({
  start: state.start,
  observed: state.observed,
  lastAt: state.lastAt,
  overall: encodeFold(state.overall),
  adaptive: encodeFold(state.adaptive),
  strands: Object.fromEntries(
    Object.entries(state.strands).map(([name, strand]) => [
      name,
      strand.fold
        ? { fold: encodeFold(strand.fold) }
        : { replay: strand.replay.map(encodeItem) },
    ]),
  ),
  confirmation: encodeConfirmation(state.confirmation, position),
});
type EncodedState = ReturnType<typeof encodeState>;
const decodeState = (
  encoded: EncodedState,
  families: readonly string[],
): FrontierState => ({
  start: encoded.start,
  observed: encoded.observed,
  lastAt: encoded.lastAt,
  overall: decodeFold(encoded.overall),
  adaptive: decodeFold(encoded.adaptive),
  strands: Object.fromEntries(
    Object.entries(encoded.strands).map(([name, strand]) => [
      name,
      strand.fold
        ? { fold: decodeFold(strand.fold) }
        : { replay: (strand.replay as number[][]).map(decodeItem) },
    ]),
  ),
  confirmation: decodeConfirmation(encoded.confirmation, families),
});

export function encodeLearnerFrontier(state: LearnerFrontierState) {
  const position = new Map(state.families.map((id, i) => [id, i]));
  return JSON.stringify({
    ...state,
    main: encodeState(state.main, position),
    restarted: Object.fromEntries(
      Object.entries(state.restarted).map(([strand, restarted]) => [
        strand,
        encodeState(restarted, position),
      ]),
    ),
  });
}

/** Null for anything unreadable: the caller replays the history, which always
 * gives the right answer. */
export function decodeLearnerFrontier(
  text: string,
): LearnerFrontierState | null {
  try {
    const encoded = JSON.parse(text);
    return {
      ...encoded,
      main: decodeState(encoded.main, encoded.families),
      restarted: Object.fromEntries(
        Object.entries(encoded.restarted as Record<string, EncodedState>).map(
          ([strand, restarted]) => [
            strand,
            decodeState(restarted, encoded.families),
          ],
        ),
      ),
    };
  } catch (error) {
    console.warn(
      "stored learner level is unreadable; replaying the history",
      error instanceof Error ? error.name : "unknown",
    );
    return null;
  }
}
