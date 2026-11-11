import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { hasProblemLesson } from "../content/problem-lessons.js";
import {
  publicProblemSchema,
  type ProblemResponse,
  type PublicProblem,
} from "../math/contracts.js";
import { generateProblem, templates } from "../math/engine.js";
import {
  answerHelpKinds,
  type WorkItem,
  type WorkReplayResponse,
} from "./teacher-contracts.js";
import {
  PERSON_FIRST,
  readable,
  skillStrandOf,
  skillTitleOf,
  workResult,
} from "./term-grades.js";

/* One answer, replayed as the student saw it. The instance row holds the
   problem exactly as it was served; the attempt row holds the answer. Both
   are immutable, so a replay is a read: no learner lock, no new record. */

/** The answer before counts as the start of this one only within a sitting. */
const SITTING_SECONDS = 15 * 60;
const templateIds = new Set(templates.map((template) => template.id));

/** A digest of what a problem draws: its origin, prompt, answer form and
 * figure. The instance id is left out, so a rebuild of the same template,
 * version and seed digests the same as the problem that was served. */
export function problemDigest(problem: PublicProblem): string {
  const { id: _id, ...drawn } = problem;
  return createHash("sha256").update(stableJson(drawn)).digest("hex");
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

type StoredOutcome = {
  id?: string;
  skillId?: string;
  templateId?: string;
  correct?: boolean;
  assisted?: boolean;
  response?: unknown;
  answer?: unknown;
  explanation?: unknown;
  parts?: unknown;
  help?: unknown;
  evidenceWeight?: number;
  evidenceSource?: string;
  createdAt?: string;
};
/** What a replay is drawn from: the stored instance and attempt, as rows. */
export type StoredWork = {
  attemptId: string;
  day: string;
  outcome: StoredOutcome;
  /** The instance's `content`: a saved problem, or whatever an older writer
   * stored. */
  content: {
    public?: Record<string, unknown>;
    answer?: unknown;
    explanation?: unknown;
    selection?: { reason?: unknown };
  } | null;
};

/** The problem to draw: the served copy when it is whole, else a rebuild
 * from its template, version and seed, else nothing. Never a stand-in. */
export function replayProblem(stored: StoredWork): {
  source: WorkReplayResponse["source"];
  problem: PublicProblem | null;
} {
  const raw = stored.content?.public;
  const served = publicProblemSchema.safeParse(raw);
  if (served.success) return { source: "served", problem: served.data };
  const templateId =
    typeof raw?.templateId === "string"
      ? raw.templateId
      : stored.outcome.templateId;
  const seed = typeof raw?.seed === "string" ? raw.seed : undefined;
  if (!templateId || !seed || !templateIds.has(templateId))
    return { source: "unavailable", problem: null };
  // A served problem's `templateVersion` is the generator's stamp (1 for all
  // but count-objects), not the catalog version it was drawn at, so it can't
  // select a version: under it, a version-2 template draws a different
  // problem for many seeds. Practice draws at the catalog's current version,
  // so the rebuild does too, and says it was rebuilt.
  const version = undefined;
  try {
    const rebuilt = generateProblem(templateId, seed, version).public;
    return {
      source: "rebuilt",
      problem:
        typeof raw?.id === "string" ? { ...rebuilt, id: raw.id } : rebuilt,
    };
  } catch (error) {
    console.error("A stored problem could not be rebuilt", {
      templateId,
      version,
      error,
    });
    return { source: "unavailable", problem: null };
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const texts = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

/** The replay of one stored answer, apart from its neighbours: pure, so the
 * mapping is tested without a database. */
export function replayOf(
  stored: StoredWork,
): Omit<
  WorkReplayResponse,
  "student" | "seconds" | "tries" | "previous" | "next"
> {
  const { outcome, content } = stored;
  const raw = content?.public;
  const { source, problem } = replayProblem(stored);
  const skillId = text(outcome.skillId) || text(raw?.skillId);
  const strand = skillStrandOf(skillId);
  const response = (problem?.response ?? raw?.response) as
    ProblemResponse | undefined;
  const answer = text(outcome.answer) || text(content?.answer);
  const item: WorkItem = {
    id: stored.attemptId,
    day: stored.day,
    at: text(outcome.createdAt),
    prompt: problem?.prompt ?? text(raw?.prompt),
    answer: readable(response, answer, strand),
    response: readable(response, outcome.response, strand),
    result: workResult(outcome),
    review: content?.selection?.reason === "review",
    skill: skillTitleOf(skillId),
    strand,
  };
  const templateId = problem?.templateId ?? text(outcome.templateId);
  const help = Array.isArray(outcome.help)
    ? answerHelpKinds.filter((kind) =>
        (outcome.help as unknown[]).includes(kind),
      )
    : null;
  return {
    item,
    skillId,
    source,
    problem: problem as unknown as Record<string, unknown> | null,
    origin: problem
      ? {
          templateId: problem.templateId,
          version: problem.templateVersion ?? null,
          seed: problem.seed,
          digest: problemDigest(problem),
        }
      : null,
    outcome: {
      correct: outcome.correct === true,
      assisted: outcome.assisted === true,
      response: text(outcome.response),
      answer,
      explanation: texts(outcome.explanation).length
        ? texts(outcome.explanation)
        : texts(content?.explanation),
      ...(Array.isArray(outcome.parts) &&
      outcome.parts.every((part) => typeof part === "boolean")
        ? { parts: outcome.parts as boolean[] }
        : {}),
      paper:
        outcome.evidenceSource === "paper" || (outcome.evidenceWeight ?? 1) < 1,
    },
    help,
    lesson: {
      skillId,
      templateId:
        templateId && hasProblemLesson(templateId) ? templateId : null,
    },
  };
}

/** Seconds from the answer before, when both were in one sitting. */
export function secondsSince(at: string, before: string | null) {
  if (!before) return null;
  const seconds = (Date.parse(at) - Date.parse(before)) / 1000;
  return Number.isFinite(seconds) && seconds > 0 && seconds <= SITTING_SECONDS
    ? Math.round(seconds)
    : null;
}

/** One of a student's answers, replayed; null when the attempt isn't this
 * student's. `skill` narrows Previous and Next to one skill (from Today's
 * "keeps missing"). The caller has already checked who may read the
 * student. */
export async function readWorkReplay(
  pool: Pool,
  personId: string,
  attemptId: string,
  skill?: string,
): Promise<WorkReplayResponse | null> {
  const found = (
    await pool.query(
      `SELECT p.id AS "personId",${PERSON_FIRST} AS first,a.learner_id AS "learnerId",
         a.id AS "attemptId",a.outcome,i.content,a.evidence_sequence::text AS sequence,
         ((a.outcome->>'createdAt')::timestamptz AT TIME ZONE COALESCE(p.timezone,'America/New_York'))::date::text AS day
       FROM amp_people p
       JOIN amp_attempts a ON a.learner_id=p.learner_id AND a.id=$2
       JOIN amp_instances i ON i.id=a.problem_id AND i.learner_id=a.learner_id
       WHERE p.id=$1 AND p.deleted_at IS NULL`,
      [personId, attemptId],
    )
  ).rows[0] as
    | (StoredWork & {
        personId: string;
        first: string;
        learnerId: string;
        sequence: string;
      })
    | undefined;
  if (!found) return null;
  const replay = replayOf(found);
  const seed = replay.origin?.seed ?? null;
  const [neighbours, before, tries] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT a.id FROM amp_attempts a WHERE a.learner_id=$1 AND a.evidence_sequence<$2::bigint
            AND ($3::text IS NULL OR a.outcome->>'skillId'=$3) ORDER BY a.evidence_sequence DESC LIMIT 1) AS previous,
         (SELECT a.id FROM amp_attempts a WHERE a.learner_id=$1 AND a.evidence_sequence>$2::bigint
            AND ($3::text IS NULL OR a.outcome->>'skillId'=$3) ORDER BY a.evidence_sequence LIMIT 1) AS next`,
      [found.learnerId, found.sequence, skill ?? null],
    ),
    pool.query(
      `SELECT a.outcome->>'createdAt' AS at FROM amp_attempts a
       WHERE a.learner_id=$1 AND a.evidence_sequence<$2::bigint
       ORDER BY a.evidence_sequence DESC LIMIT 1`,
      [found.learnerId, found.sequence],
    ),
    // The same problem again: one instance is answered once, so another try
    // is another instance with this template and seed.
    seed && replay.origin
      ? pool.query(
          `SELECT a.id,a.outcome FROM amp_attempts a
           JOIN amp_instances i ON i.id=a.problem_id AND i.learner_id=a.learner_id
           WHERE a.learner_id=$1 AND i.content->'public'->>'templateId'=$2
             AND i.content->'public'->>'seed'=$3
           ORDER BY a.evidence_sequence`,
          [found.learnerId, replay.origin.templateId, seed],
        )
      : Promise.resolve({ rows: [] }),
  ]);
  return {
    student: { id: found.personId, first: found.first },
    ...replay,
    seconds: secondsSince(replay.item.at, before.rows[0]?.at ?? null),
    tries:
      tries.rows.length > 1
        ? (tries.rows as { id: string; outcome: StoredOutcome }[]).map(
            (row) => ({
              id: row.id,
              at: text(row.outcome.createdAt),
              result: workResult(row.outcome),
            }),
          )
        : [],
    previous: neighbours.rows[0]?.previous ?? null,
    next: neighbours.rows[0]?.next ?? null,
  };
}
