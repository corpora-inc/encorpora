import type { Pool } from "pg";
import { RETENTION, RETENTION_BATCH } from "../privacy/retention-periods.js";

/**
 * Funnel retention. Events older than RETENTION.funnelEventDays are deleted;
 * those of a converted visitor (or an unattributed purchase/refund) first add
 * to monthly aggregate counts that carry no visitor ID. Visitors whose last
 * event is that old are then deleted, and checkout attribution is erased.
 */
export async function purgeFunnelEvents(
  pool: Pool,
  at = new Date(),
): Promise<{
  expiredFunnelEvents: number;
  expiredFunnelVisitors: number;
  expiredFunnelLinks: number;
}> {
  if (!Number.isFinite(at.getTime()))
    throw new Error("Invalid retention clock");
  const params = [
    at.toISOString(),
    RETENTION.funnelEventDays,
    RETENTION_BATCH.batchSize,
  ];
  const cutoff = "$1::timestamptz-make_interval(days=>$2)";
  let expiredFunnelEvents = 0,
    expiredFunnelVisitors = 0,
    expiredFunnelLinks = 0;
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const result = await pool.query<{ n: number }>(
      `WITH doomed AS (
         SELECT id FROM amp_funnel_events WHERE occurred_at<=${cutoff}
         ORDER BY occurred_at LIMIT $3 FOR UPDATE SKIP LOCKED
       ), gone AS (
         DELETE FROM amp_funnel_events e USING doomed WHERE e.id=doomed.id
         RETURNING e.visitor_id,e.event,e.occurred_at
       ), kept AS (
         INSERT INTO amp_funnel_aggregates AS a(month,event,source,device,grade_band,count)
         SELECT date_trunc('month',g.occurred_at)::date,g.event,
           COALESCE(v.utm_source,v.referrer,'unknown'),COALESCE(v.device,'unknown'),
           COALESCE(v.grade_band,'unknown'),count(*)
         FROM gone g LEFT JOIN amp_funnel_visitors v ON v.visitor_id=g.visitor_id
         WHERE g.visitor_id IS NULL OR v.converted_at IS NOT NULL
         GROUP BY 1,2,3,4,5
         ON CONFLICT(month,event,source,device,grade_band) DO UPDATE SET count=a.count+EXCLUDED.count
         RETURNING 1
       ) SELECT (SELECT count(*) FROM gone)::int AS n`,
      params,
    );
    const n = result.rows[0].n;
    expiredFunnelEvents += n;
    if (n < RETENTION_BATCH.batchSize) break;
  }
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const result = await pool.query(
      `DELETE FROM amp_funnel_visitors WHERE visitor_id IN (
         SELECT visitor_id FROM amp_funnel_visitors WHERE last_seen<=${cutoff}
         ORDER BY last_seen LIMIT $3 FOR UPDATE SKIP LOCKED)`,
      params,
    );
    expiredFunnelVisitors += result.rowCount ?? 0;
    if ((result.rowCount ?? 0) < RETENTION_BATCH.batchSize) break;
  }
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const result = await pool.query(
      `UPDATE amp_funnel_checkouts SET visitor_id=NULL WHERE checkout_id IN (
         SELECT checkout_id FROM amp_funnel_checkouts
         WHERE visitor_id IS NOT NULL AND created_at<=${cutoff}
         LIMIT $3 FOR UPDATE SKIP LOCKED)`,
      params,
    );
    expiredFunnelLinks += result.rowCount ?? 0;
    if ((result.rowCount ?? 0) < RETENTION_BATCH.batchSize) break;
  }
  return { expiredFunnelEvents, expiredFunnelVisitors, expiredFunnelLinks };
}
