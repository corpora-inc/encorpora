import type { Pool, PoolClient } from "pg";
import { trialTokenHash } from "../server/trials.js";
import {
  AGE_BANDS,
  type EventBatch,
  parseFunnelProps,
  visitorIdSchema,
} from "./events.js";

type Queryable = Pick<PoolClient, "query">;

/** Client clocks only order a batch's events; the server's clock dates them. */
const MAX_CLIENT_SKEW_MS = 10 * 60_000;

/** A coarse band from a trial's birth year; the year itself is never copied. */
export function ageBandFromBirthYear(
  birthYear: number,
  now: Date,
): (typeof AGE_BANDS)[number] {
  const age = now.getUTCFullYear() - birthYear;
  if (age < 6) return "under-6";
  if (age <= 8) return "6-8";
  if (age <= 11) return "9-11";
  if (age <= 14) return "12-14";
  return "15-plus";
}

/**
 * Stores one validated batch. The visitor row carries first-touch attribution
 * (UTM, referrer category, device) and the latest placed grade band; event
 * rows carry only the closed props. Returns the number of events stored.
 */
export async function recordEventBatch(
  pool: Pool,
  batch: EventBatch,
  now = new Date(),
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='5s'");
    // Only a live, unadopted trial links: before consent there is no account.
    const trial = batch.trial
      ? (
          await client.query<{
            analytics_id: string;
            birth_year: number | null;
          }>(
            `SELECT t.analytics_id,l.birth_year FROM amp_trials t
             LEFT JOIN amp_learners l ON l.id=t.learner_id
             WHERE t.token_hash=$1 AND t.adopted_at IS NULL AND t.expires_at>$2`,
            [trialTokenHash(batch.trial), now],
          )
        ).rows[0]
      : undefined;
    const landing = batch.events.find((e) => e.event === "landing_view")
      ?.props as
      | {
          utmSource?: string;
          utmMedium?: string;
          utmCampaign?: string;
          referrer: string;
          device: string;
        }
      | undefined;
    const placed = [...batch.events]
      .reverse()
      .find((e) => e.event === "placement_done")?.props as
      { gradeBand: string; ageBand?: string } | undefined;
    const added = [...batch.events]
      .reverse()
      .find((e) => e.event === "learner_added")?.props as
      { ageBand?: string } | undefined;
    const ageBand =
      placed?.ageBand ??
      added?.ageBand ??
      (trial?.birth_year ? ageBandFromBirthYear(trial.birth_year, now) : null);
    await client.query(
      `INSERT INTO amp_funnel_visitors AS v(visitor_id,first_seen,last_seen,trial_id,
         utm_source,utm_medium,utm_campaign,referrer,device,grade_band,age_band)
       VALUES($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(visitor_id) DO UPDATE SET
         last_seen=greatest(v.last_seen,EXCLUDED.last_seen),
         trial_id=COALESCE(EXCLUDED.trial_id,v.trial_id),
         -- First touch wins: a later internal page view keeps the campaign.
         utm_source=CASE WHEN v.referrer IS NULL THEN EXCLUDED.utm_source ELSE v.utm_source END,
         utm_medium=CASE WHEN v.referrer IS NULL THEN EXCLUDED.utm_medium ELSE v.utm_medium END,
         utm_campaign=CASE WHEN v.referrer IS NULL THEN EXCLUDED.utm_campaign ELSE v.utm_campaign END,
         referrer=COALESCE(v.referrer,EXCLUDED.referrer),
         device=COALESCE(v.device,EXCLUDED.device),
         grade_band=COALESCE(EXCLUDED.grade_band,v.grade_band),
         age_band=COALESCE(v.age_band,EXCLUDED.age_band)`,
      [
        batch.visitorId,
        now,
        trial?.analytics_id ?? null,
        landing?.utmSource ?? null,
        landing?.utmMedium ?? null,
        landing?.utmCampaign ?? null,
        landing?.referrer ?? null,
        landing?.device ?? null,
        placed?.gradeBand ?? null,
        ageBand,
      ],
    );
    const latest = Math.max(...batch.events.map((e) => e.at));
    const times = batch.events.map(
      (e) =>
        new Date(
          now.getTime() -
            Math.min(MAX_CLIENT_SKEW_MS, Math.max(0, latest - e.at)),
        ),
    );
    await client.query(
      `INSERT INTO amp_funnel_events(visitor_id,event,props,occurred_at)
       SELECT $1,e,p,t FROM unnest($2::text[],$3::jsonb[],$4::timestamptz[]) AS x(e,p,t)`,
      [
        batch.visitorId,
        batch.events.map((e) => e.event),
        batch.events.map((e) => JSON.stringify(e.props)),
        times,
      ],
    );
    await client.query("COMMIT");
    return batch.events.length;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Remembers which browser started a checkout, so a verified purchase can be
 * attributed. Invalid or missing visitor IDs are ignored. */
export async function linkCheckoutVisitor(
  db: Queryable,
  checkoutId: string,
  visitorId: string | undefined,
): Promise<void> {
  const parsed = visitorIdSchema.safeParse(visitorId);
  if (!parsed.success) return;
  await db.query(
    `INSERT INTO amp_funnel_checkouts(checkout_id,visitor_id) VALUES($1,$2)
     ON CONFLICT(checkout_id) DO UPDATE SET visitor_id=EXCLUDED.visitor_id
     WHERE amp_funnel_checkouts.purchase_recorded_at IS NULL`,
    [checkoutId, parsed.data],
  );
}

/**
 * Writes `purchase` once per checkout, from the verified webhook only. The
 * row carries the plan interval and, if known, the visitor; the checkout link
 * is erased in the same statement, so nothing joins the visitor to billing.
 */
export async function recordVerifiedPurchase(
  db: Queryable,
  checkoutId: string,
  interval: "year" | "month",
  now = new Date(),
): Promise<boolean> {
  const props = parseFunnelProps("purchase", { interval });
  const result = await db.query(
    `WITH link AS (
       INSERT INTO amp_funnel_checkouts AS c(checkout_id,purchase_recorded_at) VALUES($1,$2)
       ON CONFLICT(checkout_id) DO UPDATE SET purchase_recorded_at=$2,visitor_id=NULL
       WHERE c.purchase_recorded_at IS NULL
       RETURNING (SELECT visitor_id FROM amp_funnel_checkouts WHERE checkout_id=$1) AS visitor_id
     ), visitor AS (
       UPDATE amp_funnel_visitors v SET converted_at=COALESCE(v.converted_at,$2),last_seen=greatest(v.last_seen,$2)
       FROM link WHERE v.visitor_id=link.visitor_id RETURNING v.visitor_id
     )
     INSERT INTO amp_funnel_events(visitor_id,event,props,occurred_at)
     SELECT (SELECT visitor_id FROM visitor),'purchase',$3::jsonb,$2 FROM link`,
    [checkoutId, now, JSON.stringify(props)],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Writes `refund` once per checkout, from verified provider refund state. */
export async function recordVerifiedRefund(
  db: Queryable,
  checkoutId: string,
  full: boolean,
  now = new Date(),
): Promise<boolean> {
  const props = parseFunnelProps("refund", { full });
  const result = await db.query(
    `WITH link AS (
       INSERT INTO amp_funnel_checkouts AS c(checkout_id,refund_recorded_at) VALUES($1,$2)
       ON CONFLICT(checkout_id) DO UPDATE SET refund_recorded_at=$2
       WHERE c.refund_recorded_at IS NULL
       RETURNING checkout_id
     )
     INSERT INTO amp_funnel_events(visitor_id,event,props,occurred_at)
     SELECT NULL,'refund',$3::jsonb,$2 FROM link`,
    [checkoutId, now, JSON.stringify(props)],
  );
  return (result.rowCount ?? 0) > 0;
}
