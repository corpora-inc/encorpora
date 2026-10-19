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
  const day = at.toISOString().slice(0, 10);
  const params = [
    at.toISOString(),
    RETENTION.funnelEventDays,
    RETENTION_BATCH.batchSize,
  ];
  const cutoff = "$1::date-$2::int";
  let expiredFunnelEvents = 0,
    expiredFunnelVisitors = 0,
    expiredFunnelLinks = 0;
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const result = await pool.query<{ n: number }>(
      `WITH doomed AS (
         SELECT id FROM amp_funnel_events WHERE occurred_on<=${cutoff}
         ORDER BY occurred_on,id LIMIT $3 FOR UPDATE SKIP LOCKED
       ), gone AS (
         DELETE FROM amp_funnel_events e USING doomed WHERE e.id=doomed.id
         RETURNING e.visitor_id,e.event,e.occurred_on
       ), kept AS (
         INSERT INTO amp_funnel_aggregates AS a(month,event,source,device,grade_band,count)
         SELECT date_trunc('month',g.occurred_on)::date,g.event,
           COALESCE(v.utm_source,v.referrer,'unknown'),COALESCE(v.device,'unknown'),
           COALESCE(v.grade_band,'unknown'),count(*)
         FROM gone g LEFT JOIN amp_funnel_visitors v ON v.visitor_id=g.visitor_id
         WHERE g.visitor_id IS NULL OR v.converted_on IS NOT NULL
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
         SELECT v.visitor_id FROM amp_funnel_visitors v WHERE v.last_seen<=${cutoff}
         -- Never cascade events that have not been counted yet.
         AND NOT EXISTS(SELECT 1 FROM amp_funnel_events e WHERE e.visitor_id=v.visitor_id)
         ORDER BY v.last_seen LIMIT $3 FOR UPDATE SKIP LOCKED)`,
      params,
    );
    expiredFunnelVisitors += result.rowCount ?? 0;
    if ((result.rowCount ?? 0) < RETENTION_BATCH.batchSize) break;
  }
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const result = await pool.query(
      `UPDATE amp_funnel_checkouts SET visitor_id=NULL WHERE checkout_id IN (
         SELECT f.checkout_id FROM amp_funnel_checkouts f
         JOIN amp_stripe_checkouts c ON c.id=f.checkout_id
         WHERE f.visitor_id IS NOT NULL AND c.created_at<=${cutoff}
         LIMIT $3 FOR UPDATE OF f SKIP LOCKED)`,
      params,
    );
    expiredFunnelLinks += result.rowCount ?? 0;
    if ((result.rowCount ?? 0) < RETENTION_BATCH.batchSize) break;
  }
  return { expiredFunnelEvents, expiredFunnelVisitors, expiredFunnelLinks };
}
