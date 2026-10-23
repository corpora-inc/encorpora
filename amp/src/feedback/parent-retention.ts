import type { Pool } from "pg";
import { RETENTION, RETENTION_BATCH } from "../privacy/retention-periods.js";
export async function purgeParentFeedback(
  pool: Pool,
  at = new Date(),
): Promise<number> {
  if (!Number.isFinite(at.getTime()))
    throw new Error("Invalid retention clock");
  let count = 0;
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const result = await pool.query(
      `DELETE FROM amp_parent_feedback WHERE request_id IN (
      SELECT request_id FROM amp_parent_feedback
      WHERE created_at <= $1::timestamptz-make_interval(days=>$2)
      ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED)`,
      [
        at.toISOString(),
        RETENTION.parentFeedbackDays,
        RETENTION_BATCH.batchSize,
      ],
    );
    count += result.rowCount ?? 0;
    if ((result.rowCount ?? 0) < RETENTION_BATCH.batchSize) break;
  }
  return count;
}
