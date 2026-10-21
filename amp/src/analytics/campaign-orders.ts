import type { Pool } from "pg";

/** Current states of requests created in the window, not ad-attributed sales.
 * Program classification comes only from the retained, operator-configured offer.
 */
export async function arkansasOrderSummary(pool: Pool, days: number) {
  const result = await pool.query(
    `SELECT
    count(*)::int AS prepared_request_records,
    count(*) FILTER (WHERE r.status='parent-reported-submitted')::int AS parent_reported_submitted,
    count(*) FILTER (WHERE r.status='cancelled')::int AS cancelled_requests,
    count(o.id)::int AS linked_esa_orders,
    count(*) FILTER (WHERE o.order_state->>'approval'='approved')::int AS approved_orders,
    count(*) FILTER (WHERE o.order_state->>'settlement'='settled')::int AS settled_orders,
    count(*) FILTER (WHERE o.grant_state IS NOT NULL)::int AS issued_license_orders,
    count(*) FILTER (WHERE o.grant_state->>'status'='revoked')::int AS revoked_license_orders,
    count(*) FILTER (WHERE o.order_state->>'refund'='completed')::int AS refunded_orders
    FROM amp_funding_requests r
    LEFT JOIN amp_commerce_orders o ON o.id=r.order_id AND o.channel='esa'
    WHERE r.offer_snapshot->>'programId'='ar-efa'
      AND r.offer_snapshot->>'jurisdiction'='AR'
      AND r.created_at >= ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int) AT TIME ZONE 'UTC'`,
    [days - 1],
  );
  return result.rows[0];
}
