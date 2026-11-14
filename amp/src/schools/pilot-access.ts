import { SchoolError } from "./contracts.js";
import type { Pool, PoolClient } from "pg";
import type { FreeAllowance } from "../learning/free-allowance.js";
import { localDayStart, studentInClassSql } from "./principal.js";

/** One read shared by practice, student /me and the teacher's workbook view. */
export async function schoolPilotAccess(
  db: Pick<PoolClient, "query">,
  learnerId: string,
) {
  const { rows } = await db.query<{
    managed: boolean;
    until: Date | null;
    active: boolean;
  }>(
    `WITH access AS MATERIALIZED (
      SELECT amp_school_managed($1) AS managed, amp_school_pilot_until($1) AS until
    ) SELECT managed,until,COALESCE(until>now(),false) AS active FROM access`,
    [learnerId],
  );
  return rows[0]!;
}

/** Preserve actual usage counters, but do not offer family allowances to schools. */
export function schoolAllowance(
  allowance: FreeAllowance,
  managed: boolean,
): FreeAllowance {
  return managed
    ? {
        problems: { ...allowance.problems, remaining: 0 },
        workbooks: { ...allowance.workbooks, available: 0 },
      }
    : allowance;
}

/** Whether a class takes sign-ins today: not archived, and its academic
 * session not over in its school's zone. The one predicate student sign-in
 * (`SchoolSignIn.liveClass`), the practice gate (and through it the code and
 * card endpoints) and `classRecheckAt` all read (CP-3 r6): a code is never
 * shown that `/join` would refuse. `c` and `o` alias the class and its org. */
export const classLiveSql = (c: string, o: string) =>
  `(${c}.archived_at IS NULL AND EXISTS(SELECT 1 FROM amp_academic_sessions live_s
     WHERE live_s.id=${c}.session_id AND live_s.ends_on>=(now() AT TIME ZONE ${o}.timezone)::date))`;

/** Why a school class's students can't practice, when they can't: their
 * teacher hasn't started practice, or it has ended. `null` when sign-in leads
 * somewhere: practice is running, a student is covered (a seat, or another
 * class's practice), the school has seats to give, or the class isn't a
 * school's (a family's, a demo). */
export type PracticeGate = "waiting" | "ended";

/** A class's gate, for sign-in: `/join` refuses before the pictures step, so
 * a class doesn't choose pictures for nothing. */
export async function classPracticeGate(
  db: Pick<PoolClient, "query">,
  classId: string,
): Promise<PracticeGate | null> {
  return (await classPracticeGates(db, [classId])).get(classId) ?? null;
}

/** Why a class's practice has ended (CP-3 r7): its school year (session)
 * is over or the class archived, none of its students can sign in today, or
 * the coverage ran out. Each has its own next step; only the last is
 * answered by seats. */
export type PracticeEnd = "session" | "roster" | "coverage";

/** Each class's gate, in one read (a school's class list). A class missing
 * from the answer has none to report; an archived one, or one whose session
 * is over, has ended. */
export async function classPracticeGates(
  db: Pick<PoolClient, "query">,
  classIds: readonly string[],
): Promise<Map<string, PracticeGate>> {
  const gates = new Map<string, PracticeGate>();
  for (const [id, state] of await classPracticeStates(db, classIds))
    gates.set(id, state.gate);
  return gates;
}

/** Each gated class's gate and, once ended, why. Covered students are
 * students who can enter today (`studentInClassSql`, the predicate `/join`
 * and student sessions read) and whom a pilot or a valid grant covers. */
export async function classPracticeStates(
  db: Pick<PoolClient, "query">,
  classIds: readonly string[],
): Promise<Map<string, { gate: PracticeGate; end: PracticeEnd | null }>> {
  if (!classIds.length) return new Map();
  const { rows } = await db.query<{
    id: string;
    exempt: boolean;
    live: boolean;
    licensed: boolean;
    started: boolean;
    entering: boolean;
    covered: boolean;
  }>(
    `SELECT c.id,o.demo OR o.kind='family' AS exempt,${classLiveSql("c", "o")} AS live,
      EXISTS(SELECT 1 FROM amp_school_licenses l WHERE l.org_id=ANY(o.path)
        AND l.status='active' AND l.starts_at<=now() AND l.ends_at>now()) AS licensed,
      EXISTS(SELECT 1 FROM amp_class_pilots cp JOIN amp_teacher_pilots t ON t.id=cp.pilot_id
        WHERE cp.class_id=c.id AND t.started_at<=now()) AS started,
      EXISTS(SELECT 1 FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
        WHERE ${studentInClassSql("e", "p", "c", "o")}) AS entering,
      EXISTS(SELECT 1 FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
        WHERE ${studentInClassSql("e", "p", "c", "o")}
          AND (amp_school_pilot_until(p.learner_id)>now() OR EXISTS(
            SELECT 1 FROM amp_grants g WHERE g.learner_id=p.learner_id AND g.status='active'
              AND g.starts_at<=now() AND g.ends_at>now() AND amp_school_grant_valid(g.id)))) AS covered
    FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE c.id=ANY($1::uuid[])`,
    [classIds],
  );
  const states = new Map<
    string,
    { gate: PracticeGate; end: PracticeEnd | null }
  >();
  for (const row of rows) {
    // A family's or a demo's class is never gated (a family's session is
    // carried into the next year before its code is read at /join).
    if (row.exempt) continue;
    // Archived, or its session over: no student signs in, whatever covers
    // them (the student's own entry refuses the code).
    if (!row.live) states.set(row.id, { gate: "ended", end: "session" });
    else if (!row.licensed && !row.covered)
      states.set(
        row.id,
        row.started
          ? { gate: "ended", end: row.entering ? "coverage" : "roster" }
          : { gate: "waiting", end: null },
      );
  }
  return states;
}

/** The next moment anything that decides a class's practice, or this
 * reader's access to it, can change (CP-3 r4 H1, r5): a license, a valid
 * seat or a grant, a teacher's pilot, its grace or an extension starting or
 * ending; any of the class's students' enrollments (here, or in a class
 * whose pilot covers them) or student roles starting or ending; the
 * reader's own role and enrollment, a Clever administrator's bootstrap
 * authority, and the class's session ending (`classLiveSql`). A date flips at `localDayStart` (the same comparison the gate
 * makes), in every time zone the gate could read it in: the role's own
 * school, and each school the student's classes are in. Over-collecting is
 * safe: it is a moment to ask again, and the server's answer decides.
 * Read with the gate in one snapshot (`classPractice`). */
export async function classRecheckAt(
  db: Pick<PoolClient, "query">,
  classId: string,
  accountId: string | null = null,
): Promise<string | null> {
  const row = (
    await db.query<{ exempt: boolean; next: Date | null }>(
      classRecheckQuery(classId, accountId),
    )
  ).rows[0];
  if (!row || row.exempt !== false || !row.next) return null;
  return new Date(row.next).toISOString();
}

/** `classRecheckAt`'s one statement, for it and for the plan check that
 * holds its work to the class's roster (tests/school-practice-recheck). It
 * starts from the class's own roster (`pupils`, by the class's index) and
 * follows each of those people through their own rows by index (fenced
 * LATERAL reads), plus the reader's own roles and the licenses on the
 * class's org path: its work grows with the roster and those people's own
 * enrollments, roles, seats and grants, never with the rest of the
 * district. */
export function classRecheckQuery(classId: string, accountId: string | null) {
  const day = localDayStart("dz.d", "dz.tz");
  return {
    text: `WITH klass AS (
         SELECT c.id,c.session_id,o.path,o.timezone,o.demo OR o.kind='family' AS exempt
         FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE c.id=$1),
       -- The roster first, by the class's own index. Every dependency below
       -- is then followed per person (LATERAL ... OFFSET 0: the planner
       -- can't turn it into a scan of the whole table), so the work is the
       -- roster's people and their own rows, whatever else the district holds.
       pupils AS MATERIALIZED (
         SELECT DISTINCT p.id AS person,p.learner_id AS learner FROM amp_enrollments e
         CROSS JOIN LATERAL (SELECT p.id,p.learner_id FROM amp_people p
           WHERE p.id=e.person_id AND p.deleted_at IS NULL OFFSET 0) p
         WHERE e.class_id=$1 AND e.role='student'
           AND (e.end_on IS NULL OR e.end_on>=current_date-2)),
       -- Every current class a student is in (its pilot may cover them).
       placed AS MATERIALIZED (
         SELECT x.* FROM pupils u CROSS JOIN LATERAL (
           SELECT e.person_id AS person,e.begin_on,e.end_on,c.id AS class,o.timezone
           FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
           JOIN amp_orgs o ON o.id=c.org_id
           WHERE e.person_id=u.person AND e.role='student'
             AND (e.end_on IS NULL OR e.end_on>=current_date-2) OFFSET 0) x),
       roles AS MATERIALIZED (
         SELECT x.* FROM pupils u CROSS JOIN LATERAL (
           SELECT r.person_id AS person,r.begin_on,r.end_on,o.timezone
           FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
           WHERE r.person_id=u.person AND r.role='student'
             AND (r.end_on IS NULL OR r.end_on>=current_date-2) OFFSET 0) x),
       mine AS (
         SELECT r.id,r.role,r.begin_on,r.end_on,o.timezone FROM amp_people me
         JOIN amp_org_roles r ON r.person_id=me.id JOIN amp_orgs o ON o.id=r.org_id, klass k
         WHERE me.account_id=$2 AND me.deleted_at IS NULL AND r.org_id=ANY(k.path)),
       -- Each date with each zone the gate reads it in: an enrollment in
       -- its class's school; a student role in its own school (seats) and
       -- in each school the student's classes are in (pilots); the reader's
       -- role in its school and the class's; the reader's enrollment here;
       -- and the day after the class's session ends (classLiveSql).
       dz(d,tz) AS (
         SELECT x,e.timezone FROM placed e, LATERAL unnest(ARRAY[e.begin_on,e.end_on]) x
         UNION SELECT x,r.timezone FROM roles r, LATERAL unnest(ARRAY[r.begin_on,r.end_on]) x
         UNION SELECT x,e.timezone FROM roles r JOIN placed e ON e.person=r.person,
           LATERAL unnest(ARRAY[r.begin_on,r.end_on]) x
         UNION SELECT x,m.timezone FROM mine m, LATERAL unnest(ARRAY[m.begin_on,m.end_on]) x
         UNION SELECT x,k.timezone FROM mine m, klass k,
           LATERAL unnest(ARRAY[m.begin_on,m.end_on]) x
         UNION SELECT x,k.timezone FROM amp_people me
           JOIN amp_enrollments e ON e.person_id=me.id AND e.class_id=$1, klass k,
           LATERAL unnest(ARRAY[e.begin_on,e.end_on]) x
           WHERE me.account_id=$2 AND me.deleted_at IS NULL
         UNION SELECT s.ends_on+1,k.timezone FROM klass k
           JOIN amp_academic_sessions s ON s.id=k.session_id),
       times(t) AS (
         SELECT ${day} FROM dz WHERE dz.d IS NOT NULL AND dz.d>=current_date-2
         UNION ALL SELECT x FROM amp_school_licenses l, klass k,
           LATERAL unnest(ARRAY[l.starts_at,l.ends_at]) x
           WHERE l.org_id=ANY(k.path) AND l.status='active'
         -- Only a seat that can be valid: open, on an active license.
         UNION ALL SELECT x FROM pupils u CROSS JOIN LATERAL (
             SELECT l.starts_at,l.ends_at FROM amp_seats s
             JOIN amp_school_licenses l ON l.id=s.license_id AND l.status='active'
             WHERE s.person_id=u.person AND s.released_at IS NULL OFFSET 0) l,
           LATERAL unnest(ARRAY[l.starts_at,l.ends_at]) x
         UNION ALL SELECT x FROM pupils u CROSS JOIN LATERAL (
             SELECT g.starts_at,g.ends_at FROM amp_grants g
             WHERE g.learner_id=u.learner AND g.status='active' OFFSET 0) g,
           LATERAL unnest(ARRAY[g.starts_at,g.ends_at]) x
         UNION ALL SELECT x FROM (SELECT DISTINCT cp.pilot_id FROM placed e
             JOIN amp_class_pilots cp ON cp.class_id=e.class) used
           JOIN amp_teacher_pilots t ON t.id=used.pilot_id,
           LATERAL unnest(ARRAY[t.started_at,t.ends_at,t.grace_ends_at]) x
         UNION ALL SELECT x.until_at FROM (SELECT DISTINCT cp.pilot_id FROM placed e
             JOIN amp_class_pilots cp ON cp.class_id=e.class) used
           JOIN amp_pilot_extensions x ON x.pilot_id=used.pilot_id
         -- A Clever administrator's authority ends at its bootstrap's end:
         -- the same membership amp_school_role_current reads (owned, an
         -- admin role), found by the owned (kind,local_id) index.
         UNION ALL SELECT m.bootstrap_valid_until FROM mine
           JOIN amp_clever_memberships m ON m.kind='org_role' AND m.local_id=mine.id AND m.owned
           WHERE mine.role='admin' AND m.bootstrap_valid_until IS NOT NULL)
       SELECT (SELECT exempt FROM klass) AS exempt,
         (SELECT min(t) FROM times WHERE t>now()) AS next`,
    values: [classId, accountId],
  };
}

/** Runs `read` in one read-only, repeatable-read snapshot: every query in
 * it sees the same rows at the same `now()` (a transaction's). The year route
 * authorizes its reader and reads the class's practice in one (CP-3 r6). */
export async function inSnapshot<T>(
  pool: Pool,
  read: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await read(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Where a class stands for one reader: the gate, the next moment to ask
 * again and the server's clock. Read inside the caller's snapshot
 * (`inSnapshot`), with the reader's authority, so a boundary falling while
 * the answer is assembled is never lost between them. */
export async function readClassPractice(
  db: Pick<PoolClient, "query">,
  classId: string,
  accountId: string | null,
): Promise<{
  gate: PracticeGate | null;
  /** Why it ended, when it has. */
  end: PracticeEnd | null;
  recheckAt: string | null;
  serverNow: string;
}> {
  const state = (await classPracticeStates(db, [classId])).get(classId);
  const recheckAt = await classRecheckAt(db, classId, accountId);
  const clock = await db.query<{ now: Date }>("SELECT now() AS now");
  return {
    gate: state?.gate ?? null,
    end: state?.end ?? null,
    recheckAt,
    serverNow: new Date(clock.rows[0]!.now).toISOString(),
  };
}

/** `readClassPractice` in a snapshot of its own. */
export const classPractice = (
  pool: Pool,
  classId: string,
  accountId: string | null,
) => inSnapshot(pool, (db) => readClassPractice(db, classId, accountId));

/** Sign-in tools (the class code, the board, printed cards) only while a
 * student can practice: refused before Start and after practice ends
 * (SPEC R14), so a code or card never reaches a student for nothing. */
export async function assertSignInOpen(
  db: Pick<PoolClient, "query">,
  classId: string,
) {
  if (await classPracticeGate(db, classId))
    throw new SchoolError(409, "practice_closed");
}

/** A signed-in student's gate, for `/me`: only for a school's student whom
 * nothing covers (`pilot` from schoolPilotAccess). */
export async function studentPracticeGate(
  db: Pick<PoolClient, "query">,
  pilot: { managed: boolean; until: Date | null },
  homePath: string[] | string,
): Promise<PracticeGate | "seat" | null> {
  if (!pilot.managed) return null;
  const licensed = (
    await db.query(
      `SELECT 1 FROM amp_school_licenses l WHERE l.org_id=ANY($1::uuid[])
        AND l.status='active' AND l.starts_at<=now() AND l.ends_at>now() LIMIT 1`,
      [homePath],
    )
  ).rowCount;
  // A school with seats: the teacher gives this student one.
  if (licensed) return "seat";
  return pilot.until ? "ended" : "waiting";
}
