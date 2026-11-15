import type { Pool, PoolClient } from "pg";
import { STARTER_ANSWERS } from "./events.js";

/*
 * Activation milestones (docs/engagement-measurement.md#activation-milestones).
 * The server writes the first time an account reaches each step of its first
 * run, where the step really happens, so an ad blocker or a closed tab cannot
 * drop it. One row per account and step (`amp_activation_milestones`); a
 * repeat is a no-op on the primary key. Rows hold no names, learners or
 * answers, and work done inside a demo org never counts.
 *
 * A failure here is logged and swallowed: measurement never fails the
 * learner's or teacher's real action.
 */

export type Persona = (typeof STARTER_ANSWERS)[number];

export const ACTIVATION_STEPS = [
  /** Every persona. */
  "account_created",
  "persona_chosen",
  /** Parent and tutor: a child or student; the first problem any of the
   * account's learners answers; 20 answers; a workbook opened or printed. */
  "learner_added",
  "first_answer",
  "answers_20",
  "workbook_opened",
  /** Teacher: a real class, its first student, the first answer in it and
   * 20 answers in it. */
  "class_created",
  "student_joined",
  "class_first_answer",
  "class_answers_20",
  /** School: the school, its first added teacher, and the demo opened. */
  "school_created",
  "teacher_added",
  "demo_opened",
] as const;
export type ActivationStep = (typeof ACTIVATION_STEPS)[number];

/** Each persona's first run, in order. The report reads these columns. */
export const PERSONA_STEPS = {
  parent: [
    "account_created",
    "persona_chosen",
    "learner_added",
    "first_answer",
    "answers_20",
    "workbook_opened",
  ],
  tutor: [
    "account_created",
    "persona_chosen",
    "learner_added",
    "first_answer",
    "answers_20",
    "workbook_opened",
  ],
  myself: ["account_created", "persona_chosen", "first_answer", "answers_20"],
  teacher: [
    "account_created",
    "persona_chosen",
    "class_created",
    "student_joined",
    "class_first_answer",
    "class_answers_20",
  ],
  school: [
    "account_created",
    "persona_chosen",
    "demo_opened",
    "school_created",
    "teacher_added",
  ],
} as const satisfies Record<Persona, readonly ActivationStep[]>;

/** Answers that make the "20 problems" milestone. */
export const ACTIVATION_ANSWERS = 20;

type Db = Pick<Pool | PoolClient, "query">;

export type Activation = {
  step: ActivationStep;
  /** When the caller knows it; otherwise the persona the account chose. */
  persona?: Persona | null;
  /** The org the step happened in. A demo org never counts, and a school
   * step (`school`) never counts in a family's org. */
  orgId?: string | null;
  school?: boolean;
} & (
  | {
      /** A sign-in account (`amp|…`). Trials, school student sign-ins and
       * anything else are not people starting AMP, and are ignored. */
      accountId: string | null | undefined;
      personId?: never;
    }
  | {
      /** A roster person: their sign-in account, if they have one. */
      personId: string | null | undefined;
      accountId?: never;
    }
);

/** The persona the account chose, for a row recorded without one. */
const CHOSEN = (account: string) =>
  `(SELECT c.persona FROM amp_activation_milestones c WHERE c.account_id=${account} AND c.step='persona_chosen')`;
/** Whether org `org` sits in a demo, or (`family`) in a family's org. */
const EXCLUDED_ORG = (org: string, family: string) =>
  `EXISTS(SELECT 1 FROM amp_orgs o JOIN amp_orgs r ON r.id=o.path[1]
     WHERE o.id=${org} AND (r.demo OR (${family} AND r.kind='family')))`;

/**
 * Record a milestone once. Inside a transaction it runs in a savepoint, so a
 * failure cannot abort the caller's work.
 */
export async function recordActivation(
  db: Db,
  activation: Activation,
): Promise<void> {
  const { step, persona, orgId, school } = activation;
  if (!activation.accountId && !activation.personId) return;
  if (activation.accountId && !activation.accountId.startsWith("amp|")) return;
  await guarded(db, step, () =>
    db.query(
      `INSERT INTO amp_activation_milestones(account_id,step,persona)
       SELECT a.id,$2,COALESCE($3,${CHOSEN("a.id")})
       FROM (SELECT COALESCE($1::text,(SELECT p.account_id FROM amp_people p WHERE p.id=$5::uuid AND p.deleted_at IS NULL)) AS id) a
       WHERE a.id LIKE 'amp|%' AND ($4::uuid IS NULL OR NOT ${EXCLUDED_ORG("$4::uuid", "$6::boolean")})
       ON CONFLICT (account_id,step) DO NOTHING`,
      [
        activation.accountId ?? null,
        step,
        persona ?? null,
        orgId ?? null,
        activation.personId ?? null,
        school === true,
      ],
    ),
  );
}

/**
 * A new enrollment in a real school class (never a family's or a demo's): a
 * teacher's means they have a class (`class_created`); a student's is the
 * class's first student for each of its teachers (`student_joined`).
 */
export async function recordEnrollmentActivation(
  db: Db,
  classId: string,
  personId: string,
  role: string,
): Promise<void> {
  if (role !== "teacher" && role !== "student") return;
  await guarded(db, "enrollment", () =>
    db.query(
      `WITH klass AS (
         SELECT c.id FROM amp_classes c WHERE c.id=$1::uuid AND NOT ${EXCLUDED_ORG("c.org_id", "true")}
       ), who AS (
         SELECT p.account_id,'class_created'::text AS step FROM klass, amp_people p
         WHERE $3='teacher' AND p.id=$2::uuid AND p.deleted_at IS NULL
         UNION
         SELECT t.account_id,'student_joined' FROM klass k
         JOIN amp_enrollments te ON te.class_id=k.id AND te.role='teacher' AND te.end_on IS NULL
         JOIN amp_people t ON t.id=te.person_id AND t.deleted_at IS NULL
         WHERE $3='student'
       )
       INSERT INTO amp_activation_milestones(account_id,step,persona)
       SELECT w.account_id,w.step,${CHOSEN("w.account_id")} FROM who w
       WHERE w.account_id LIKE 'amp|%'
       ON CONFLICT (account_id,step) DO NOTHING`,
      [classId, personId, role],
    ),
  );
}

/**
 * The milestones a learner's new answer, or new workbook, can complete for
 * the people it counts for: the account that owns the learner (a parent's
 * child, an adult's own practice) and the teacher of a family org's class (a
 * tutor's or co-op's students) reach `first_answer`, `answers_20` and
 * `workbook_opened`; each teacher of a real school class the learner is in
 * reaches `class_first_answer` and `class_answers_20`. Demo orgs and
 * simulated learners never count. Cheap once recorded: a target that has its
 * milestones is skipped before any counting.
 */
export async function recordLearnerActivation(
  db: Db,
  learnerId: string,
  done: "answer" | "workbook",
): Promise<void> {
  await guarded(db, done, () =>
    done === "answer"
      ? db.query(ANSWER_MILESTONES, [learnerId, ACTIVATION_ANSWERS])
      : db.query(WORKBOOK_MILESTONE, [learnerId]),
  );
}

/* Who a learner's work counts for: its own account, and each teacher of a
   live class it is in, with the class whose answers count (none: every
   learner the account owns) and whether that class is a family org's. */
const TARGETS = `
learner AS (
  SELECT l.id,l.account_id FROM amp_learners l
  WHERE l.id=$1::text AND l.deleted_at IS NULL AND NOT l.simulation
), in_demo AS (
  SELECT EXISTS(SELECT 1 FROM learner l JOIN amp_people p ON p.learner_id=l.id
    JOIN amp_orgs o ON o.id=p.tenant_id JOIN amp_orgs r ON r.id=o.path[1]
    WHERE r.demo) AS demo
), targets AS (
  SELECT l.account_id,true AS family,NULL::uuid AS class_id
  FROM learner l, in_demo WHERE l.account_id LIKE 'amp|%' AND NOT in_demo.demo
  UNION
  SELECT t.account_id,r.kind='family',c.id
  FROM learner l
  JOIN amp_people p ON p.learner_id=l.id
  JOIN amp_enrollments e ON e.person_id=p.id AND e.role='student' AND e.end_on IS NULL
  JOIN amp_classes c ON c.id=e.class_id
  JOIN amp_orgs o ON o.id=c.org_id JOIN amp_orgs r ON r.id=o.path[1] AND NOT r.demo
  JOIN amp_enrollments te ON te.class_id=c.id AND te.role='teacher' AND te.end_on IS NULL
  JOIN amp_people t ON t.id=te.person_id AND t.deleted_at IS NULL AND t.account_id LIKE 'amp|%'
)`;

const ANSWER_MILESTONES = `
WITH ${TARGETS}, steps AS (
  SELECT t.account_id,t.class_id,
    CASE WHEN t.family THEN 'first_answer' ELSE 'class_first_answer' END AS first,
    CASE WHEN t.family THEN 'answers_20' ELSE 'class_answers_20' END AS twenty
  FROM targets t
), open AS (
  SELECT s.*,
    EXISTS(SELECT 1 FROM amp_activation_milestones m WHERE m.account_id=s.account_id AND m.step=s.first) AS has_first,
    EXISTS(SELECT 1 FROM amp_activation_milestones m WHERE m.account_id=s.account_id AND m.step=s.twenty) AS has_twenty
  FROM steps s
), counted AS (
  SELECT o.*, CASE WHEN o.has_twenty THEN 0 WHEN o.class_id IS NULL THEN (
      SELECT count(*) FROM (SELECT 1 FROM amp_learners x JOIN amp_attempts a ON a.learner_id=x.id
        WHERE x.account_id=o.account_id AND x.deleted_at IS NULL AND NOT x.simulation LIMIT $2) n)
    ELSE (
      -- Answers in the class: each student's from when they joined it.
      SELECT count(*) FROM (SELECT 1 FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
        JOIN amp_attempts a ON a.learner_id=p.learner_id AND a.created_at>=e.created_at
        WHERE e.class_id=o.class_id AND e.role='student' LIMIT $2) n)
    END AS answers
  FROM open o WHERE NOT (o.has_first AND o.has_twenty)
), due(account_id,step) AS (
  SELECT account_id,first FROM counted WHERE NOT has_first
  UNION SELECT account_id,twenty FROM counted WHERE NOT has_twenty AND answers>=$2
)
INSERT INTO amp_activation_milestones(account_id,step,persona)
SELECT d.account_id,d.step,${CHOSEN("d.account_id")} FROM due d
ON CONFLICT (account_id,step) DO NOTHING`;

const WORKBOOK_MILESTONE = `
WITH ${TARGETS}, due AS (
  SELECT DISTINCT t.account_id FROM targets t WHERE t.family
    AND NOT EXISTS(SELECT 1 FROM amp_activation_milestones m WHERE m.account_id=t.account_id AND m.step='workbook_opened')
)
INSERT INTO amp_activation_milestones(account_id,step,persona)
SELECT d.account_id,'workbook_opened',${CHOSEN("d.account_id")} FROM due d
ON CONFLICT (account_id,step) DO NOTHING`;

const log = (error: unknown, step: string) =>
  console.error(
    JSON.stringify({
      level: "error",
      msg: "activation milestone not recorded",
      step,
      error: error instanceof Error ? error.message : String(error),
    }),
  );

let savepoints = 0;
async function guarded(
  db: Db,
  step: string,
  write: () => Promise<unknown>,
): Promise<void> {
  // A Pool runs the write alone. A client may be inside the caller's
  // transaction, where a savepoint keeps a failure from aborting it; outside
  // one, Postgres refuses the savepoint (25P01) and the write runs alone.
  let savepoint: string | null = null;
  if (!("totalCount" in db)) {
    const name = `amp_activation_${++savepoints % 1_000_000}`;
    try {
      await db.query(`SAVEPOINT ${name}`);
      savepoint = name;
    } catch (error) {
      if ((error as { code?: string }).code !== "25P01")
        return log(error, step);
    }
  }
  try {
    await write();
    if (savepoint) await db.query(`RELEASE SAVEPOINT ${savepoint}`);
  } catch (error) {
    log(error, step);
    if (savepoint)
      await db
        .query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        .catch((rollback) => log(rollback, step));
  }
}
