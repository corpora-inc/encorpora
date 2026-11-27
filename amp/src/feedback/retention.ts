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
  const [expiredProblemFlagNotes, expiredProblemFlags] = await purgeReports(
    pool,
    at,
    `UPDATE amp_problem_flags SET note=NULL WHERE id IN (SELECT id FROM amp_problem_flags
      WHERE note IS NOT NULL AND created_at<=$1::timestamptz-make_interval(days=>$2) ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED)`,
    `DELETE FROM amp_problem_flags WHERE id IN (SELECT id FROM amp_problem_flags
      WHERE created_at<=$1::timestamptz-make_interval(days=>$2) ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED)`,
  );
  return { expiredProblemFlagNotes, expiredProblemFlags };
}

/**
 * "Report this film" retention: the same periods as "Report a problem"
 * (one kind of report, one disclosure). Notes are erased
 * RETENTION.problemFlagNoteDays after a report is sent, and reports are
 * deleted after RETENTION.problemFlagDays. Bounded batches; counts only.
 */
export async function purgeFilmFlags(
  pool: Pool,
  at = new Date(),
): Promise<{ expiredFilmFlagNotes: number; expiredFilmFlags: number }> {
  const [expiredFilmFlagNotes, expiredFilmFlags] = await purgeReports(
    pool,
    at,
    `UPDATE amp_film_flags SET note=NULL WHERE id IN (SELECT id FROM amp_film_flags
      WHERE note IS NOT NULL AND created_at<=$1::timestamptz-make_interval(days=>$2) ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED)`,
    `DELETE FROM amp_film_flags WHERE id IN (SELECT id FROM amp_film_flags
      WHERE created_at<=$1::timestamptz-make_interval(days=>$2) ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED)`,
  );
  return { expiredFilmFlagNotes, expiredFilmFlags };
}

/** Runs a report table's note erasure (`notes`, after
 * RETENTION.problemFlagNoteDays), then its row deletion (`reports`, after
 * RETENTION.problemFlagDays), in bounded batches: the counts of each. */
async function purgeReports(
  pool: Pool,
  at: Date,
  notes: string,
  reports: string,
): Promise<[notes: number, reports: number]> {
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
  return [
    await run(notes, RETENTION.problemFlagNoteDays),
    await run(reports, RETENTION.problemFlagDays),
  ];
}
