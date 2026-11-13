import type { PoolClient } from "pg";
import type { FreeAllowance } from "../learning/free-allowance.js";

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
    `SELECT amp_school_managed($1) AS managed, amp_school_pilot_until($1) AS until,
      COALESCE(amp_school_pilot_until($1)>now(),false) AS active`,
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
