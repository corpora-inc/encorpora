import type { Pool, PoolClient } from "pg";
import type { CleverClient } from "./client.js";
import { CleverSyncError } from "./model.js";
import type { LmsClient } from "./lms-client.js";
import { LmsError, lmsReady, lmsTypeNames, type LmsType } from "./lms-model.js";
import {
  assignmentCreateBody,
  assignmentUpdateBody,
  finalGradePoints,
  planSubmission,
  practicePoints,
  submissionsOpen,
  turnsIn,
  type AssignmentDraft,
  type DesiredGrade,
} from "./lms-payloads.js";
import { activityBySpan, termRoster } from "../term-grades.js";

type Db = Pick<PoolClient, "query">;
type TokenSource = Pick<CleverClient, "districtToken">;

/** How often an open assignment's grades are recomputed and returned. */
export const PASSBACK_INTERVAL_MS = 15 * 60_000;
/** A district's LMS state is reread at least this often, so a teacher sees
 * the LMS a class can publish to before any assignment exists. */
export const DISTRICT_CHECK_MS = 60 * 60_000;
/** Heartbeats from the last minutes before a due time land after it. */
export const FINAL_SETTLE_MS = 30 * 60_000;

export type LmsAssignmentRow = {
  id: string;
  class_id: string;
  section_id: string;
  kind: "practice" | "term_grade";
  title: string;
  points_possible: string;
  target_minutes: number | null;
  opens_on: string | null;
  due_on: string | null;
  session_id: string | null;
  due_at: Date;
  version: number;
  status: string;
  lms_type: LmsType | null;
  clever_assignment_id: string | null;
  lms_version: number;
  sync_requested_at: Date | null;
  last_passback_at: Date | null;
  finalized_at: Date | null;
  failure_count: number;
  failure_code: string | null;
};
export type LmsPassResult = {
  connectionId: string;
  skipped?: "busy" | "inactive" | "idle" | "backoff";
  lmsState?: string | null;
  lmsType?: LmsType | null;
  created: number;
  updated: number;
  deleted: number;
  graded: number;
  failures: Record<string, number>;
};

/** Codes a teacher's edit or the LMS itself must change; retried slowly. */
const SLOW: Record<string, string> = {
  lms_submission_update_failed: "6 hours",
  lms_user_not_found: "1 day",
  lms_user_not_in_lms: "1 day",
};

const WORK = `SELECT a.*,a.points_possible::text AS points_possible,
   to_char(a.opens_on,'YYYY-MM-DD') AS opens_on,to_char(a.due_on,'YYYY-MM-DD') AS due_on
 FROM amp_lms_assignments a
 WHERE a.connection_id=$1 AND a.status IN ('pending','published','deleting')
   AND (a.sync_requested_at IS NOT NULL OR a.next_attempt_at IS NULL OR a.next_attempt_at<=$2)
   AND (a.status<>'published' OR a.sync_requested_at IS NOT NULL OR a.version>a.lms_version
     OR (a.finalized_at IS NULL AND (a.last_passback_at IS NULL OR a.last_passback_at<=$2-interval '${PASSBACK_INTERVAL_MS / 60_000} minutes'
       OR (a.kind='practice' AND a.due_at<=$2-interval '${FINAL_SETTLE_MS / 60_000} minutes'
         AND a.last_passback_at<a.due_at+interval '${FINAL_SETTLE_MS / 60_000} minutes'))))
 ORDER BY a.status='deleting' DESC,a.next_attempt_at NULLS FIRST,a.created_at
 LIMIT 200`;

/** Connections in this environment, least recently checked first. */
export async function lmsCandidates(
  db: Db,
  environment: "sandbox" | "production",
): Promise<{ id: string }[]> {
  return (
    await db.query<{ id: string }>(
      `SELECT c.id FROM amp_clever_connections c LEFT JOIN amp_clever_lms l ON l.connection_id=c.id
       WHERE c.environment=$1 AND c.status='active'
       ORDER BY l.checked_at NULLS FIRST,c.id`,
      [environment],
    )
  ).rows;
}

/**
 * One district's LMS pass. Holds a deployment-wide session lock, so passes
 * never overlap; a killed pass leaves `creating` rows that the next pass marks
 * `unknown` (a create may have happened, and Clever cannot be asked).
 */
export async function runLmsConnection(
  pool: Pool,
  connectionId: string,
  deps: {
    clever: TokenSource;
    lms: () => LmsClient;
    /** The AMP origin students open from the LMS. */
    origin: string;
    now?: () => Date;
  },
): Promise<LmsPassResult> {
  const result: LmsPassResult = {
    connectionId,
    created: 0,
    updated: 0,
    deleted: 0,
    graded: 0,
    failures: {},
  };
  const fail = (code: string) =>
    (result.failures[code] = (result.failures[code] ?? 0) + 1);
  const db = await pool.connect();
  const key = `clever-lms:${connectionId}`;
  let locked = false;
  try {
    locked = (
      await db.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS ok",
        [key],
      )
    ).rows[0].ok;
    if (!locked) return { ...result, skipped: "busy" };
    const now = deps.now?.() ?? new Date();
    const connection = (
      await db.query(
        `SELECT c.district_id,c.status,l.checked_at,l.next_attempt_at,l.failure_count,l.failure_code
         FROM amp_clever_connections c LEFT JOIN amp_clever_lms l ON l.connection_id=c.id WHERE c.id=$1`,
        [connectionId],
      )
    ).rows[0];
    if (connection?.status !== "active")
      return { ...result, skipped: "inactive" };
    await db.query(
      `UPDATE amp_lms_assignments SET status='unknown',failure_code='lms_create_outcome_unknown',
         updated_at=now() WHERE connection_id=$1 AND status='creating'`,
      [connectionId],
    );
    const work = (await db.query<LmsAssignmentRow>(WORK, [connectionId, now]))
      .rows;
    const requested = work.some((row) => row.sync_requested_at);
    const stale =
      !connection.checked_at ||
      now.getTime() - connection.checked_at.getTime() >= DISTRICT_CHECK_MS;
    if (!work.length && !stale) return { ...result, skipped: "idle" };
    if (
      connection.next_attempt_at &&
      connection.next_attempt_at > now &&
      !requested
    )
      return { ...result, skipped: "backoff" };

    let refused = false;
    const connectionFailure = async (code: string) => {
      fail(code);
      refused = true;
      // A teacher's "Send now" is served by this attempt, not every minute.
      await db.query(
        "UPDATE amp_lms_assignments SET sync_requested_at=NULL WHERE connection_id=$1 AND sync_requested_at IS NOT NULL",
        [connectionId],
      );
      await db.query(
        `INSERT INTO amp_clever_lms(connection_id,checked_at,failure_code,failure_count,next_attempt_at)
         VALUES($1,$2,$3,1,$2::timestamptz+interval '1 minute')
         ON CONFLICT(connection_id) DO UPDATE SET checked_at=$2,failure_code=$3,
           failure_count=CASE WHEN amp_clever_lms.failure_code=$3 THEN least(amp_clever_lms.failure_count+1,10) ELSE 1 END,
           next_attempt_at=$2::timestamptz+interval '1 minute'*power(2,CASE WHEN amp_clever_lms.failure_code=$3 THEN least(amp_clever_lms.failure_count,9) ELSE 0 END)`,
        [connectionId, now, code],
      );
    };
    let token: string;
    const client = deps.lms();
    let lmsType: LmsType;
    try {
      token = await deps.clever.districtToken(connection.district_id);
      const district = await client.district(token, connection.district_id);
      result.lmsState = district.lms_state;
      result.lmsType = district.lms_type;
      await db.query(
        `INSERT INTO amp_clever_lms(connection_id,lms_state,lms_type,checked_at) VALUES($1,$2,$3,$4)
         ON CONFLICT(connection_id) DO UPDATE SET lms_state=$2,lms_type=$3,checked_at=$4`,
        [connectionId, district.lms_state, district.lms_type, now],
      );
      if (!lmsReady(district) || !district.lms_type) {
        const code = !lmsReady(district) ? "lms_not_ready" : "lms_type_unknown";
        if (work.length) {
          fail(code);
          await db.query(
            `UPDATE amp_lms_assignments SET failure_code=$2,sync_requested_at=NULL,updated_at=now()
             WHERE connection_id=$1 AND status IN ('pending','published')`,
            [connectionId, code],
          );
        }
        // Rechecked every 15 minutes, or when a teacher asks; never each minute.
        await db.query(
          `UPDATE amp_clever_lms SET failure_code=$2,failure_count=0,
             next_attempt_at=$3::timestamptz+interval '15 minutes' WHERE connection_id=$1`,
          [connectionId, code, now],
        );
        return result;
      }
      lmsType = district.lms_type;
    } catch (error) {
      await connectionFailure(codeOf(error));
      return result;
    }
    for (const row of work) {
      try {
        await processAssignment(db, row, {
          client,
          token,
          lmsType,
          connectionId,
          origin: deps.origin,
          now,
          result,
          fail,
        });
      } catch (error) {
        const code = codeOf(error);
        if (error instanceof LmsError && error.capability) {
          await connectionFailure(code);
          break;
        }
        fail(code);
        if (code === "lms_budget_exhausted") break;
        await assignmentFailure(db, row, code, now);
      }
    }
    if (!refused)
      await db.query(
        "UPDATE amp_clever_lms SET failure_code=NULL,failure_count=0,next_attempt_at=NULL WHERE connection_id=$1",
        [connectionId],
      );
    return result;
  } finally {
    let broken = false;
    try {
      if (locked)
        await db.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
          key,
        ]);
    } catch (error) {
      broken = true;
      throw error;
    } finally {
      db.release(broken);
    }
  }
}

/** If AMP can't record a created assignment's ID, say it where an operator
 * looks: the row turns `unknown` on the next pass, and this ID is the only
 * way to find the column again. */
async function storeCreated(
  row: LmsAssignmentRow,
  cleverId: string,
  write: () => Promise<unknown>,
) {
  try {
    await write();
  } catch (error) {
    console.error(
      JSON.stringify({
        lmsCreatedUnrecorded: {
          assignment: row.id,
          cleverAssignment: cleverId,
        },
      }),
    );
    throw error;
  }
}

function codeOf(error: unknown): string {
  if (error instanceof CleverSyncError) return error.code;
  return "lms_worker_failed";
}
/** Backoff runs on the pass's clock, one minute doubling to 512 minutes. */
async function assignmentFailure(
  db: Db,
  row: LmsAssignmentRow,
  code: string,
  now: Date,
) {
  await db.query(
    `UPDATE amp_lms_assignments SET failure_code=$2,
       failure_count=CASE WHEN failure_code=$2 THEN least(failure_count+1,10) ELSE 1 END,
       next_attempt_at=$3::timestamptz+interval '1 minute'*power(2,CASE WHEN failure_code=$2 THEN least(failure_count,9) ELSE 0 END),
       sync_requested_at=NULL,updated_at=now()
     WHERE id=$1`,
    [row.id, code, now],
  );
}

type Pass = {
  client: LmsClient;
  token: string;
  lmsType: LmsType;
  connectionId: string;
  origin: string;
  now: Date;
  result: LmsPassResult;
  fail: (code: string) => void;
};

async function processAssignment(db: Db, row: LmsAssignmentRow, pass: Pass) {
  const { client, token, lmsType, now, result } = pass;
  const section = (
    await db.query(
      `SELECT b.record->>'term_id' AS term_id,c.archived_at
       FROM amp_clever_bindings b JOIN amp_classes c ON c.id=b.local_id
       WHERE b.connection_id=$1 AND b.kind='section' AND b.clever_id=$2 AND b.local_id=$3
         AND b.archived_at IS NULL`,
      [pass.connectionId, row.section_id, row.class_id],
    )
  ).rows[0];
  const shared = section && !section.archived_at;
  if (row.status === "deleting") {
    let outcome: "deleted" | "missing" | "unreachable" = "unreachable";
    // An unshared section can't be reached any more, so no call is made; the
    // column stays the district's. Anything else (an outage) is retried.
    if (shared)
      try {
        outcome = await client.deleteAssignment(
          token,
          row.section_id,
          row.clever_assignment_id!,
        );
      } catch (error) {
        if (!(error instanceof LmsError) || error.lmsCode !== "lms_not_found")
          throw error;
      }
    await db.query(
      `UPDATE amp_lms_assignments SET status='deleted',deleted_at=COALESCE(deleted_at,$2),
         failure_code=$3,failure_count=0,next_attempt_at=NULL,sync_requested_at=NULL,updated_at=now()
       WHERE id=$1 AND status='deleting'`,
      [row.id, now, outcome === "unreachable" ? "lms_section_unshared" : null],
    );
    result.deleted++;
    return;
  }
  if (!shared) {
    // The district no longer shares this section: no call can be made for it.
    pass.fail("lms_section_unshared");
    await assignmentFailure(db, row, "lms_section_unshared", now);
    return;
  }
  if (row.status === "pending") {
    const remote = await client.section(token, row.section_id);
    if (!remote.synced) {
      pass.fail("lms_section_not_synced");
      await assignmentFailure(db, row, "lms_section_not_synced", now);
      return;
    }
    const body = assignmentCreateBody(
      lmsType,
      await draftFor(db, row, remote.term_id ?? section.term_id, pass.origin),
      now,
    );
    const claimed = await db.query(
      `UPDATE amp_lms_assignments SET status='creating',create_started_at=$2,lms_type=$3,updated_at=now()
       WHERE id=$1 AND status='pending' AND version=$4`,
      [row.id, now, lmsType, row.version],
    );
    if (!claimed.rowCount) return; // Edited or deleted meanwhile; next pass.
    let created;
    try {
      created = await client.createAssignment(token, row.section_id, body);
    } catch (error) {
      const unknown =
        error instanceof LmsError &&
        error.lmsCode === "lms_create_outcome_unknown";
      await db.query(
        `UPDATE amp_lms_assignments SET status=$2,create_started_at=CASE WHEN $2='pending' THEN NULL ELSE create_started_at END,
           updated_at=now() WHERE id=$1 AND status='creating'`,
        [row.id, unknown ? "unknown" : "pending"],
      );
      if (unknown) {
        pass.fail("lms_create_outcome_unknown");
        await db.query(
          "UPDATE amp_lms_assignments SET failure_code='lms_create_outcome_unknown',sync_requested_at=NULL WHERE id=$1",
          [row.id],
        );
        return;
      }
      throw error;
    }
    // Stored the moment it exists: there is no other way to find it again.
    await storeCreated(row, created.id, () =>
      db.query(
        `UPDATE amp_lms_assignments SET status=CASE WHEN status='creating' THEN 'published'
           WHEN status='deleted' THEN 'deleting' ELSE status END,
         clever_assignment_id=$2,lms_version=$3,lms_state=$4,create_started_at=NULL,
         failure_code=NULL,failure_count=0,next_attempt_at=NULL,updated_at=now()
       WHERE id=$1`,
        [row.id, created.id, row.version, created.state ?? null],
      ),
    );
    result.created++;
    return;
  }
  // Published.
  if (row.version > row.lms_version) {
    let updated;
    try {
      updated = await client.updateAssignment(
        token,
        row.section_id,
        row.clever_assignment_id!,
        assignmentUpdateBody(
          lmsType,
          await draftFor(db, row, section.term_id, pass.origin),
          now,
        ),
      );
    } catch (error) {
      if (await missingInLms(db, row, error, now)) return;
      throw error;
    }
    await db.query(
      `UPDATE amp_lms_assignments SET lms_version=greatest(lms_version,$2),lms_state=$3,
         failure_code=NULL,failure_count=0,next_attempt_at=NULL,updated_at=now() WHERE id=$1`,
      [row.id, row.version, updated.state ?? null],
    );
    result.updated++;
  }
  await passback(db, row, pass);
}

async function missingInLms(
  db: Db,
  row: LmsAssignmentRow,
  error: unknown,
  now: Date,
) {
  if (
    !(error instanceof LmsError) ||
    error.lmsCode !== "lms_assignment_missing"
  )
    return false;
  // Deleted in the LMS by someone else: AMP stops writing to it.
  await db.query(
    `UPDATE amp_lms_assignments SET status='missing',deleted_at=COALESCE(deleted_at,$2),
       failure_code=NULL,next_attempt_at=NULL,sync_requested_at=NULL,updated_at=now()
     WHERE id=$1 AND status='published'`,
    [row.id, now],
  );
  return true;
}

/** The LMS column's text. The link opens AMP; a student signs in there. */
async function draftFor(
  db: Db,
  row: LmsAssignmentRow,
  termId: string | null,
  origin: string,
): Promise<AssignmentDraft> {
  let description: string;
  if (row.kind === "practice") {
    description = `Practice ${row.target_minutes} minutes in AMP from ${row.opens_on} to ${row.due_on}. Points follow the minutes practiced.`;
  } else {
    const term = (
      await db.query("SELECT name FROM amp_academic_sessions WHERE id=$1", [
        row.session_id,
      ])
    ).rows[0];
    description = `${term?.name ?? "Term"} grade from AMP.`;
  }
  return {
    title: row.title,
    description,
    dueAt: row.due_at,
    pointsPossible: Number(row.points_possible),
    link: new URL("/", origin).href,
    termId,
  };
}

/** Each student's grade from AMP's own records. A practice goal counts the
 * measured minutes inside the window, clipped to each student's enrollment;
 * a term grade is the teacher's numeric final. Nobody else's numbers. */
export async function desiredGrades(
  db: Db,
  row: LmsAssignmentRow,
  now: Date,
): Promise<{ grades: Map<string, DesiredGrade>; final: boolean }> {
  const grades = new Map<string, DesiredGrade>();
  const points = Number(row.points_possible);
  if (row.kind === "practice") {
    const final = now.getTime() >= row.due_at.getTime() + FINAL_SETTLE_MS;
    const today = (
      await db.query(
        `SELECT to_char($2::timestamptz AT TIME ZONE o.timezone,'YYYY-MM-DD') AS today
         FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE c.id=$1`,
        [row.class_id, now],
      )
    ).rows[0]?.today as string | undefined;
    if (!today) return { grades, final };
    const to = today < row.due_on! ? today : row.due_on!;
    const students = await termRoster(db, row.class_id, {
      from: row.opens_on!,
      to,
    });
    const activity = await activityBySpan(db, students);
    for (const student of students)
      grades.set(student.id, {
        points: practicePoints(
          activity.get(student.id)?.activeMinutes ?? 0,
          row.target_minutes!,
          points,
        ),
        final,
      });
    return { grades, final };
  }
  const { rows } = await db.query(
    `SELECT g.person_id,g.final_value FROM amp_term_grades g JOIN amp_people p ON p.id=g.person_id
     WHERE g.class_id=$1 AND g.session_id=$2 AND p.deleted_at IS NULL`,
    [row.class_id, row.session_id],
  );
  for (const grade of rows)
    grades.set(grade.person_id, {
      points: finalGradePoints(grade.final_value, points),
      final: true,
    });
  const closed = (
    await db.query(
      "SELECT 1 FROM amp_term_grades WHERE class_id=$1 AND session_id=$2 AND frozen_at IS NOT NULL LIMIT 1",
      [row.class_id, row.session_id],
    )
  ).rowCount;
  return { grades, final: !!closed };
}

async function passback(db: Db, row: LmsAssignmentRow, pass: Pass) {
  const { client, token, lmsType, now, result } = pass;
  // The database's clock, which also stamps a teacher's request.
  const started: Date = (await db.query("SELECT clock_timestamp() AS t"))
    .rows[0].t;
  let remote;
  try {
    remote = await client.getAssignment(
      token,
      row.section_id,
      row.clever_assignment_id!,
    );
  } catch (error) {
    if (await missingInLms(db, row, error, now)) return;
    throw error;
  }
  await db.query("UPDATE amp_lms_assignments SET lms_state=$2 WHERE id=$1", [
    row.id,
    remote.state ?? null,
  ]);
  if (!submissionsOpen(lmsType, remote.state)) {
    // Canvas: unpublished; Classroom: not yet open. The teacher opens it there.
    const code =
      lmsType === "canvas"
        ? "lms_assignment_unpublished"
        : "lms_assignment_not_open";
    pass.fail(code);
    await assignmentFailure(db, row, code, now);
    return;
  }
  const { grades, final } = await desiredGrades(db, row, now);
  const sent = new Map(
    (
      await db.query(
        `SELECT user_id,person_id,lms_state,sent_points::float8 AS sent_points,turned_in,next_attempt_at,failure_count,failure_code
         FROM amp_lms_submissions WHERE assignment_id=$1`,
        [row.id],
      )
    ).rows.map((entry) => [entry.user_id as string, entry]),
  );
  // Someone whose earlier grade no longer has evidence behind it.
  for (const entry of sent.values())
    if (entry.person_id && !grades.has(entry.person_id))
      grades.set(entry.person_id, { points: null, final });
  const people = [...grades.keys()];
  const users = new Map(
    (
      await db.query(
        `SELECT local_id,clever_id FROM amp_clever_bindings
         WHERE connection_id=$1 AND kind='user' AND archived_at IS NULL AND local_id=ANY($2::uuid[])`,
        [pass.connectionId, people],
      )
    ).rows.map((entry) => [
      entry.local_id as string,
      entry.clever_id as string,
    ]),
  );
  const observed = new Map(
    (await client.submissions(token, row.section_id, row.clever_assignment_id!))
      .filter((entry) => entry.user_id)
      .map((entry) => [entry.user_id!, entry]),
  );
  let waiting = 0;
  for (const [personId, desired] of grades) {
    const userId = users.get(personId);
    if (!userId) continue; // Not a Clever student of this district.
    const previous = sent.get(userId);
    if (previous?.next_attempt_at && previous.next_attempt_at > now) {
      waiting++;
      continue;
    }
    const remoteSubmission = observed.get(userId);
    const record = async (fields: {
      state: string | null;
      points?: number | null;
      final?: boolean;
      turnedIn?: boolean;
      failure?: string | null;
    }) => {
      const slow = fields.failure ? SLOW[fields.failure] : undefined;
      await db.query(
        `INSERT INTO amp_lms_submissions(assignment_id,user_id,person_id,lms_state,sent_points,sent_final,sent_at,failure_code,failure_count,next_attempt_at,turned_in)
         SELECT $1,$2,$3,$4,$5,COALESCE($6,false),CASE WHEN $7 THEN $8::timestamptz END,$9,CASE WHEN $9::text IS NULL THEN 0 ELSE 1 END,
           CASE WHEN $9::text IS NULL THEN NULL WHEN $10::text IS NOT NULL THEN $8::timestamptz+$10::interval ELSE $8::timestamptz+interval '1 minute' END,COALESCE($11,false)
         -- A person deleted while this pass ran is not written back.
         WHERE EXISTS(SELECT 1 FROM amp_people WHERE id=$3 AND deleted_at IS NULL)
         ON CONFLICT(assignment_id,user_id) DO UPDATE SET person_id=EXCLUDED.person_id,
           turned_in=COALESCE($11,amp_lms_submissions.turned_in),
           lms_state=COALESCE(EXCLUDED.lms_state,amp_lms_submissions.lms_state),
           sent_points=CASE WHEN $7 THEN EXCLUDED.sent_points ELSE amp_lms_submissions.sent_points END,
           sent_final=CASE WHEN $7 THEN EXCLUDED.sent_final ELSE amp_lms_submissions.sent_final END,
           sent_at=CASE WHEN $7 THEN EXCLUDED.sent_at ELSE amp_lms_submissions.sent_at END,
           failure_code=EXCLUDED.failure_code,
           failure_count=CASE WHEN EXCLUDED.failure_code IS NULL THEN 0
             WHEN amp_lms_submissions.failure_code=EXCLUDED.failure_code THEN least(amp_lms_submissions.failure_count+1,10) ELSE 1 END,
           next_attempt_at=CASE WHEN EXCLUDED.failure_code IS NULL THEN NULL
             WHEN $10::text IS NOT NULL THEN $8::timestamptz+$10::interval
             ELSE $8::timestamptz+interval '1 minute'*power(2,CASE WHEN amp_lms_submissions.failure_code=EXCLUDED.failure_code THEN least(amp_lms_submissions.failure_count,9) ELSE 0 END) END`,
        [
          row.id,
          userId,
          personId,
          fields.state,
          fields.points ?? null,
          fields.final ?? null,
          fields.points !== undefined,
          now,
          fields.failure ?? null,
          slow ?? null,
          fields.turnedIn ?? null,
        ],
      );
    };
    if (!remoteSubmission) {
      // Clever lists every student the assignment reaches; one it doesn't is
      // unmatched in the LMS or not in its copy of the section. Retried daily.
      if (desired.points !== null) {
        if (previous?.failure_code !== "lms_user_not_in_lms")
          pass.fail("lms_user_not_in_lms");
        await record({ state: null, failure: "lms_user_not_in_lms" });
        waiting++;
      }
      continue;
    }
    const plan = planSubmission(
      lmsType,
      {
        state: remoteSubmission.state ?? null,
        points: remoteSubmission.grade_points ?? null,
      },
      desired,
      previous
        ? { points: previous.sent_points, turnedIn: previous.turned_in }
        : null,
    );
    if (plan.kind === "none") {
      // Keep what AMP already tracks current; a student AMP never wrote to
      // needs no row.
      if (
        previous &&
        (previous.failure_code ||
          (remoteSubmission.state &&
            previous.lms_state !== remoteSubmission.state))
      )
        await record({ state: remoteSubmission.state ?? null });
      continue;
    }
    if (plan.kind === "unsupported") {
      if (previous?.failure_code !== plan.code) {
        pass.fail(plan.code);
        // Stable until AMP's grade changes again: never retried in a loop.
        await db.query(
          `UPDATE amp_lms_submissions SET failure_code=$3,failure_count=1,next_attempt_at=NULL
           WHERE assignment_id=$1 AND user_id=$2`,
          [row.id, userId, plan.code],
        );
      }
      continue;
    }
    try {
      let state: string | null = remoteSubmission.state ?? null;
      for (const body of plan.bodies) {
        const written = await client.updateSubmission(
          token,
          row.section_id,
          row.clever_assignment_id!,
          userId,
          body,
        );
        state = written.state ?? body.state ?? state;
      }
      await record({
        state,
        points: desired.points,
        final: desired.final,
        // Turned in by AMP now; a reclaim hands it back to the student.
        turnedIn: desired.points === null ? false : turnsIn(plan) || undefined,
      });
      result.graded++;
    } catch (error) {
      if (
        error instanceof LmsError &&
        (error.capability ||
          error.lmsCode === "lms_budget_exhausted" ||
          error.lmsCode === "lms_assignment_missing")
      ) {
        if (await missingInLms(db, row, error, now)) return;
        throw error;
      }
      if (
        error instanceof LmsError &&
        error.lmsCode === "lms_assignment_unpublished"
      )
        throw error;
      const code = codeOf(error);
      pass.fail(code);
      await record({ state: null, failure: code });
      waiting++;
    }
  }
  // After the due date, a student still waiting (no LTI launch yet, not in
  // the LMS) wakes the assignment only when their own retry is due.
  await db.query(
    `UPDATE amp_lms_assignments SET last_passback_at=$2,
       sync_requested_at=CASE WHEN sync_requested_at<=$3 THEN NULL ELSE sync_requested_at END,
       finalized_at=CASE WHEN $4 THEN $2::timestamptz ELSE NULL END,
       failure_code=NULL,failure_count=0,
       next_attempt_at=CASE WHEN $6 THEN COALESCE((SELECT min(next_attempt_at) FROM amp_lms_submissions
         WHERE assignment_id=$1 AND next_attempt_at>$2::timestamptz),$2::timestamptz+interval '1 hour') END,
       updated_at=now()
     WHERE id=$1 AND version=$5`,
    [
      row.id,
      now,
      started,
      final && waiting === 0,
      row.version,
      final && waiting > 0,
    ],
  );
}

/** For logs: the LMS's display name, or "an LMS". */
export const lmsName = (type: LmsType | null) =>
  type ? lmsTypeNames[type] : "an LMS";
