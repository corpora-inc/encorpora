import type { Pool } from "pg";
import { RETENTION, RETENTION_BATCH } from "../privacy/retention-periods.js";

/**
 * "Report a problem" retention: notes are erased RETENTION.problemFlagNoteDays
 * after a report is sent, and reports are deleted after
 * RETENTION.problemFlagDays. Bounded batches; counts only.
 */
export async function purgeProblemFlags(
  pool: Pool,
  at = new Date(),
): Promise<{ expiredProblemFlagNotes: number; expiredProblemFlags: number }> {
  if (!Number.isFinite(at.getTime()))
    throw new Error("Invalid retention clock");
  const clock = at.toISOString();
  const run = async (sql: string, days: number) => {
    let total = 0;
    for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
      const result = await pool.query(sql, [
        clock,
        days,
        RETENTION_BATCH.batchSize,
      ]);
      total += result.rowCount ?? 0;
      if ((result.rowCount ?? 0) < RETENTION_BATCH.batchSize) break;
    }
    return total;
  };
  const cutoff = "$1::timestamptz-make_interval(days=>$2)";
  const expiredProblemFlagNotes = await run(
    `UPDATE amp_problem_flags SET note=NULL WHERE id IN (SELECT id FROM amp_problem_flags
      WHERE note IS NOT NULL AND created_at<=${cutoff} ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED)`,
    RETENTION.problemFlagNoteDays,
  );
  const expiredProblemFlags = await run(
    `DELETE FROM amp_problem_flags WHERE id IN (SELECT id FROM amp_problem_flags
      WHERE created_at<=${cutoff} ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED)`,
    RETENTION.problemFlagDays,
  );
  return { expiredProblemFlagNotes, expiredProblemFlags };
}
