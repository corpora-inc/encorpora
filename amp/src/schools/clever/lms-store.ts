import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { SchoolError } from "../contracts.js";
import { classContext, termById, termsFor } from "../term-grades.js";
import type { LmsType } from "./lms-model.js";

type Db = Pick<PoolClient, "query">;
type Environment = "sandbox" | "production";

/**
 * A teacher's side of LMS Connect. Every function here only reads and writes
 * AMP's rows; the LMS worker (`lms-worker.ts`) makes every Clever call.
 */
const day = z.iso.date();
const title = z.string().trim().min(1).max(120);
const points = z.number().finite().positive().max(1000);
export const lmsAssignmentInput = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("practice"),
    title,
    pointsPossible: points,
    targetMinutes: z.number().int().min(1).max(6000),
    opensOn: day,
    dueOn: day,
  }),
  z.strictObject({
    kind: z.literal("term_grade"),
    title,
    pointsPossible: points,
    termId: z.uuid(),
    dueOn: day,
  }),
]);
export type LmsAssignmentInput = z.infer<typeof lmsAssignmentInput>;

/** The class's Clever section, district connection and what Clever last said
 * about its LMS. Null: not a Clever section of an active connection here. */
export async function classLms(
  db: Db,
  classId: string,
  environment: Environment,
): Promise<{
  connectionId: string;
  sectionId: string;
  lmsType: LmsType | null;
  lmsState: string | null;
  failureCode: string | null;
} | null> {
  const row = (
    await db.query(
      `SELECT c.id AS "connectionId",b.clever_id AS "sectionId",l.lms_type AS "lmsType",
         l.lms_state AS "lmsState",l.failure_code AS "failureCode"
       FROM amp_clever_bindings b JOIN amp_clever_connections c ON c.id=b.connection_id
       LEFT JOIN amp_clever_lms l ON l.connection_id=c.id
       WHERE b.kind='section' AND b.local_id=$1 AND b.archived_at IS NULL
         AND c.status='active' AND c.environment=$2
       ORDER BY b.clever_id LIMIT 1`,
      [classId, environment],
    )
  ).rows[0];
  return row ?? null;
}

/** The end of the due day in the school's time zone, as an instant. */
async function dueAt(db: Db, classId: string, dueOn: string): Promise<Date> {
  return (
    await db.query(
      `SELECT ((($2::date+1)::timestamp AT TIME ZONE o.timezone)-interval '1 minute') AS at
       FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE c.id=$1`,
      [classId, dueOn],
    )
  ).rows[0].at;
}

async function validated(
  db: Db,
  classId: string,
  input: LmsAssignmentInput,
  now: Date,
) {
  const context = await classContext(db, classId, now);
  if (input.kind === "practice" && input.dueOn < input.opensOn)
    throw new SchoolError(400, "lms_due_before_opens");
  if (input.kind === "term_grade")
    termById(await termsFor(db, context), input.termId);
  const due = await dueAt(db, classId, input.dueOn);
  if (due.getTime() <= now.getTime())
    throw new SchoolError(400, "lms_due_date_past");
  return due;
}

/** A new LMS column for this class. The worker publishes it. */
export async function createLmsAssignment(
  db: Db,
  args: {
    classId: string;
    environment: Environment;
    input: unknown;
    personId: string | null;
    now?: Date;
  },
): Promise<{ id: string }> {
  const input = lmsAssignmentInput.parse(args.input);
  const now = args.now ?? new Date();
  const lms = await classLms(db, args.classId, args.environment);
  if (!lms) throw new SchoolError(404, "not_found");
  const due = await validated(db, args.classId, input, now);
  const id = randomUUID();
  try {
    await db.query(
      `INSERT INTO amp_lms_assignments(id,class_id,connection_id,section_id,kind,title,points_possible,
         target_minutes,opens_on,due_on,session_id,due_at,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id,
        args.classId,
        lms.connectionId,
        lms.sectionId,
        input.kind,
        input.title,
        input.pointsPossible,
        input.kind === "practice" ? input.targetMinutes : null,
        input.kind === "practice" ? input.opensOn : null,
        input.dueOn,
        input.kind === "term_grade" ? input.termId : null,
        due,
        args.personId,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new SchoolError(409, "lms_term_already_linked");
    throw error;
  }
  return { id };
}

async function owned(db: Db, classId: string, id: string) {
  const row = (
    await db.query(
      `SELECT id,kind,status,session_id FROM amp_lms_assignments
       WHERE id=$1 AND class_id=$2 FOR UPDATE`,
      [id, classId],
    )
  ).rows[0];
  if (!row) throw new SchoolError(404, "not_found");
  return row as {
    id: string;
    kind: "practice" | "term_grade";
    status: string;
    session_id: string | null;
  };
}

/** A teacher's edit. The worker sends it to the LMS; grades are recomputed. */
export async function updateLmsAssignment(
  db: Db,
  args: { classId: string; id: string; input: unknown; now?: Date },
) {
  const input = lmsAssignmentInput.parse(args.input);
  const now = args.now ?? new Date();
  const row = await owned(db, args.classId, args.id);
  if (row.status === "creating")
    throw new SchoolError(409, "lms_assignment_busy", 5);
  if (!["pending", "published"].includes(row.status))
    throw new SchoolError(409, "lms_assignment_closed");
  if (input.kind !== row.kind) throw new SchoolError(400, "lms_kind_fixed");
  if (input.kind === "term_grade" && input.termId !== row.session_id)
    throw new SchoolError(400, "lms_term_fixed");
  const due = await validated(db, args.classId, input, now);
  // Guarded by the status read: the worker may have claimed it meanwhile.
  const changed = await db.query(
    `UPDATE amp_lms_assignments SET title=$2,points_possible=$3,target_minutes=$4,opens_on=$5,due_on=$6,
       due_at=$7,version=version+1,finalized_at=NULL,failure_code=NULL,failure_count=0,
       next_attempt_at=NULL,updated_at=now() WHERE id=$1 AND status=$8`,
    [
      args.id,
      input.title,
      input.pointsPossible,
      input.kind === "practice" ? input.targetMinutes : null,
      input.kind === "practice" ? input.opensOn : null,
      input.dueOn,
      due,
      row.status,
    ],
  );
  if (!changed.rowCount) throw new SchoolError(409, "lms_assignment_busy", 5);
}

/** Removes it in AMP now and from the LMS on the next pass. An assignment
 * that never reached the LMS, or whose create went unanswered, is simply
 * closed: AMP has no ID to delete. */
export async function deleteLmsAssignment(
  db: Db,
  args: { classId: string; id: string; now?: Date },
) {
  const row = await owned(db, args.classId, args.id);
  if (row.status === "creating")
    throw new SchoolError(409, "lms_assignment_busy", 5);
  const next =
    row.status === "published"
      ? "deleting"
      : ["pending", "unknown"].includes(row.status)
        ? "deleted"
        : row.status;
  const changed = await db.query(
    `UPDATE amp_lms_assignments SET status=$2,deleted_at=COALESCE(deleted_at,$3),
       failure_code=NULL,failure_count=0,next_attempt_at=NULL,sync_requested_at=NULL,updated_at=now()
     WHERE id=$1 AND status=$4`,
    [args.id, next, args.now ?? new Date(), row.status],
  );
  // The worker claimed it between the read and this write: try again.
  if (!changed.rowCount) throw new SchoolError(409, "lms_assignment_busy", 5);
}

/** After an unanswered create the teacher has checked the LMS and wants it
 * published again. This can make a second column if the first did arrive. */
export async function republishLmsAssignment(
  db: Db,
  args: { classId: string; id: string },
) {
  const row = await owned(db, args.classId, args.id);
  if (row.status !== "unknown")
    throw new SchoolError(409, "lms_assignment_not_unknown");
  await db.query(
    `UPDATE amp_lms_assignments SET status='pending',create_started_at=NULL,failure_code=NULL,
       failure_count=0,next_attempt_at=NULL,sync_requested_at=now(),updated_at=now()
     WHERE id=$1 AND status='unknown'`,
    [args.id],
  );
}

/** "Send now": the next worker pass, within a minute, ignoring backoff once.
 * Repeating it inside a minute changes nothing. */
export async function requestLmsSync(
  db: Db,
  args: { classId: string; id: string },
) {
  const row = await owned(db, args.classId, args.id);
  if (!["pending", "published"].includes(row.status))
    throw new SchoolError(409, "lms_assignment_closed");
  await db.query(
    `UPDATE amp_lms_assignments SET sync_requested_at=now(),finalized_at=NULL,updated_at=now()
     WHERE id=$1 AND status IN ('pending','published')
       AND (sync_requested_at IS NULL OR sync_requested_at<now()-interval '1 minute')`,
    [args.id],
  );
}

export type LmsAssignmentView = {
  id: string;
  kind: "practice" | "term_grade";
  title: string;
  pointsPossible: number;
  targetMinutes: number | null;
  opensOn: string | null;
  dueOn: string;
  termId: string | null;
  termName: string | null;
  status:
    | "pending"
    | "creating"
    | "unknown"
    | "published"
    | "deleting"
    | "deleted"
    | "missing";
  lmsState: string | null;
  failureCode: string | null;
  finalized: boolean;
  syncRequested: boolean;
  lastPassbackAt: string | null;
  /** Students whose grade is in the LMS, and those it could not reach. */
  graded: number;
  blocked: number;
  /** Why students could not be reached, by code. */
  blockedBy: Record<string, number>;
  createdAt: string;
};
/** Every live assignment of the class, newest first, with how far its grades
 * have reached the LMS. Deleted ones drop out once the LMS has them gone. */
export async function readLmsAssignments(
  db: Db,
  classId: string,
): Promise<LmsAssignmentView[]> {
  const { rows } = await db.query(
    `SELECT a.id,a.kind,a.title,a.points_possible::float8 AS "pointsPossible",a.target_minutes AS "targetMinutes",
       to_char(a.opens_on,'YYYY-MM-DD') AS "opensOn",to_char(a.due_on,'YYYY-MM-DD') AS "dueOn",
       a.session_id AS "termId",s.name AS "termName",a.status,a.lms_state AS "lmsState",a.failure_code AS "failureCode",
       a.finalized_at IS NOT NULL AS finalized,a.sync_requested_at IS NOT NULL AS "syncRequested",
       a.last_passback_at AS "lastPassbackAt",a.created_at AS "createdAt",
       COALESCE(g.graded,0)::int AS graded,COALESCE(g.blocked,0)::int AS blocked,COALESCE(g.codes,'{}'::jsonb) AS "blockedBy"
     FROM amp_lms_assignments a
     LEFT JOIN amp_academic_sessions s ON s.id=a.session_id
     LEFT JOIN LATERAL (
       SELECT count(*) FILTER (WHERE sent_points IS NOT NULL AND failure_code IS NULL) AS graded,
         count(*) FILTER (WHERE failure_code IS NOT NULL) AS blocked,
         (SELECT jsonb_object_agg(code,n) FROM (SELECT failure_code AS code,count(*) AS n FROM amp_lms_submissions
            WHERE assignment_id=a.id AND failure_code IS NOT NULL GROUP BY failure_code) c) AS codes
       FROM amp_lms_submissions WHERE assignment_id=a.id
     ) g ON true
     WHERE a.class_id=$1 AND a.status<>'deleted'
     ORDER BY a.created_at DESC,a.id
     LIMIT 100`,
    [classId],
  );
  return rows.map((row) => ({
    ...row,
    lastPassbackAt: row.lastPassbackAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
