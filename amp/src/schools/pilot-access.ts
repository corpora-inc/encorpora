import { SchoolError } from "./contracts.js";
import type { PoolClient } from "pg";
import type { FreeAllowance } from "../learning/free-allowance.js";
import { activeToday } from "./principal.js";

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

/** Each class's gate, in one read (a school's class list). A class missing
 * from the answer, or archived, has none to report. */
export async function classPracticeGates(
  db: Pick<PoolClient, "query">,
  classIds: readonly string[],
): Promise<Map<string, PracticeGate>> {
  if (!classIds.length) return new Map();
  const { rows } = await db.query<{
    id: string;
    exempt: boolean;
    licensed: boolean;
    started: boolean;
    covered: boolean;
  }>(
    `SELECT c.id,o.demo OR o.kind='family' AS exempt,
      EXISTS(SELECT 1 FROM amp_school_licenses l WHERE l.org_id=ANY(o.path)
        AND l.status='active' AND l.starts_at<=now() AND l.ends_at>now()) AS licensed,
      EXISTS(SELECT 1 FROM amp_class_pilots cp JOIN amp_teacher_pilots t ON t.id=cp.pilot_id
        WHERE cp.class_id=c.id AND t.started_at<=now()) AS started,
      EXISTS(SELECT 1 FROM amp_enrollments e
        JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
        WHERE e.class_id=c.id AND e.role='student' AND ${activeToday("e", "o")}
          AND (amp_school_pilot_until(p.learner_id)>now() OR EXISTS(
            SELECT 1 FROM amp_grants g WHERE g.learner_id=p.learner_id AND g.status='active'
              AND g.starts_at<=now() AND g.ends_at>now() AND amp_school_grant_valid(g.id)))) AS covered
    FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE c.id=ANY($1::uuid[])`,
    [classIds],
  );
  const gates = new Map<string, PracticeGate>();
  for (const row of rows)
    if (!row.exempt && !row.licensed && !row.covered)
      gates.set(row.id, row.started ? "ended" : "waiting");
  return gates;
}

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
