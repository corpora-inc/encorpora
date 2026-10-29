import type { Pool, PoolClient } from "pg";
import { siteActionSchema } from "./site-actions.js";
import { engagementSchema } from "./engagement.js";
import { trialTokenHash } from "../server/trials.js";
import {
  AGE_BANDS,
  type EventBatch,
  parseFunnelProps,
  visitorIdSchema,
} from "./events.js";

type Queryable = Pick<PoolClient, "query">;

/** Funnel rows are dated by whole UTC day: a finer time could be matched
 * against checkout or payment timestamps and re-identify a visitor. */
export const funnelDay = (at: Date) => at.toISOString().slice(0, 10);

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
 * (UTM, referrer category, device), the latest placed grade band and a coarse
 * age band; event rows carry only the closed props, in batch order. A trial
 * token is used only to read the trial's age band; no trial identifier is
 * stored, so a later trial adoption cannot join a visitor to an account.
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
             WHERE t.token_hash=$1 AND t.owner_account_id IS NULL AND t.adopted_at IS NULL AND t.expires_at>$2`,
            [trialTokenHash(batch.trial), now],
          )
        ).rows[0]
      : undefined;
    const landing =
      batch.context ??
      (batch.events.find((e) => e.event === "landing_view")?.props as
        | {
            utmSource?: string;
            utmMedium?: string;
            utmCampaign?: string;
            utmContent?: string;
            referrer: string;
            device: string;
          }
        | undefined);
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
    const day = funnelDay(now);
    await client.query(
      `INSERT INTO amp_funnel_visitors AS v(visitor_id,first_seen,last_seen,
         utm_source,utm_medium,utm_campaign,referrer,device,grade_band,age_band,traffic_kind,utm_content)
       VALUES($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT(visitor_id) DO UPDATE SET
         last_seen=greatest(v.last_seen,EXCLUDED.last_seen),
         traffic_kind=CASE WHEN v.traffic_kind IN ('internal','automated') THEN v.traffic_kind
           WHEN EXCLUDED.traffic_kind<>'unknown' THEN EXCLUDED.traffic_kind ELSE v.traffic_kind END,
         -- First touch wins: a later internal page view keeps the campaign.
         utm_source=CASE WHEN v.referrer IS NULL THEN EXCLUDED.utm_source ELSE v.utm_source END,
         utm_medium=CASE WHEN v.referrer IS NULL THEN EXCLUDED.utm_medium ELSE v.utm_medium END,
         utm_campaign=CASE WHEN v.referrer IS NULL THEN EXCLUDED.utm_campaign ELSE v.utm_campaign END,
         utm_content=CASE WHEN v.referrer IS NULL THEN EXCLUDED.utm_content ELSE v.utm_content END,
         referrer=COALESCE(v.referrer,EXCLUDED.referrer),
         device=COALESCE(v.device,EXCLUDED.device),
         grade_band=COALESCE(EXCLUDED.grade_band,v.grade_band),
         age_band=COALESCE(v.age_band,EXCLUDED.age_band)`,
      [
        batch.visitorId,
        day,
        landing?.utmSource ?? null,
        landing?.utmMedium ?? null,
        landing?.utmCampaign ?? null,
        landing?.referrer ?? null,
        landing?.device ?? null,
        placed?.gradeBand ?? null,
        ageBand,
        batch.traffic ?? "unknown",
        landing?.utmContent ?? null,
      ],
    );
    for (const event of batch.events.filter(
      (e) => e.event === "page_engagement",
    )) {
      const p = engagementSchema.parse(event.props);
      await client.query(
        `INSERT INTO amp_engagement_pages AS p
        (visitor_id,page_id,session_id,ordinal,screen,occurred_on,visible_ms,active_ms)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT(visitor_id,page_id) DO UPDATE SET
          visible_ms=greatest(p.visible_ms,EXCLUDED.visible_ms),
          active_ms=greatest(p.active_ms,EXCLUDED.active_ms)
        WHERE p.session_id=EXCLUDED.session_id AND p.ordinal=EXCLUDED.ordinal
          AND p.screen=EXCLUDED.screen`,
        [
          batch.visitorId,
          p.pageId,
          p.sessionId,
          p.ordinal,
          p.screen,
          day,
          p.visibleMs,
          p.activeMs,
        ],
      );
    }
    for (const event of batch.events.filter((e) => e.event === "site_action")) {
      const p = siteActionSchema.parse(event.props);
      await client.query(
        `INSERT INTO amp_journey_actions(visitor_id,event_id,occurred_on,screen,action)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(visitor_id,event_id) DO NOTHING`,
        [batch.visitorId, p.eventId, day, p.screen, p.action],
      );
    }
    const ordinary = batch.events.filter(
      (e) => e.event !== "page_engagement" && e.event !== "site_action",
    );
    await client.query(
      `INSERT INTO amp_funnel_events(visitor_id,event,props,occurred_on)
       SELECT $1,e,p,$4 FROM unnest($2::text[],$3::jsonb[]) WITH ORDINALITY AS x(e,p,n)
       ORDER BY n`,
      [
        batch.visitorId,
        ordinary.map((e) => e.event),
        ordinary.map((e) => JSON.stringify(e.props)),
        day,
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
     WHERE NOT amp_funnel_checkouts.purchase_recorded`,
    [checkoutId, parsed.data],
  );
}

/**
 * Writes `purchase` once per checkout, from the verified webhook only. The
 * row carries the plan interval, the day and, if known, the visitor; the
 * checkout link is erased in the same statement and keeps only a flag, so
 * nothing joins the visitor to billing.
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
       INSERT INTO amp_funnel_checkouts AS c(checkout_id,purchase_recorded) VALUES($1,true)
       ON CONFLICT(checkout_id) DO UPDATE SET purchase_recorded=true,visitor_id=NULL
       WHERE NOT c.purchase_recorded
       RETURNING (SELECT visitor_id FROM amp_funnel_checkouts WHERE checkout_id=$1) AS visitor_id
     ), visitor AS (
       UPDATE amp_funnel_visitors v SET converted_on=COALESCE(v.converted_on,$2),last_seen=greatest(v.last_seen,$2)
       FROM link WHERE v.visitor_id=link.visitor_id RETURNING v.visitor_id
     )
     INSERT INTO amp_funnel_events(visitor_id,event,props,occurred_on)
     SELECT (SELECT visitor_id FROM visitor),'purchase',$3::jsonb,$2 FROM link`,
    [checkoutId, funnelDay(now), JSON.stringify(props)],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Writes `refund` once per checkout from verified provider refund state, and
 * once more if a partial refund later becomes full. */
export async function recordVerifiedRefund(
  db: Queryable,
  checkoutId: string,
  full: boolean,
  now = new Date(),
): Promise<boolean> {
  const props = parseFunnelProps("refund", { full });
  // `upgrade` marks a second row for one refunded purchase, so the report
  // counts refunded purchases once and full refunds once.
  const result = await db.query(
    `WITH prior AS (
       SELECT refund_recorded FROM amp_funnel_checkouts WHERE checkout_id=$1
     ), link AS (
       INSERT INTO amp_funnel_checkouts AS c(checkout_id,refund_recorded,full_refund_recorded) VALUES($1,true,$2)
       ON CONFLICT(checkout_id) DO UPDATE SET refund_recorded=true,full_refund_recorded=c.full_refund_recorded OR $2
       WHERE NOT c.refund_recorded OR ($2 AND NOT c.full_refund_recorded)
       RETURNING checkout_id
     )
     INSERT INTO amp_funnel_events(visitor_id,event,props,occurred_on)
     SELECT NULL,'refund',
       CASE WHEN COALESCE((SELECT refund_recorded FROM prior),false)
         THEN $3::jsonb||'{"upgrade":true}' ELSE $3::jsonb END,$4
     FROM link`,
    [checkoutId, full, JSON.stringify(props), funnelDay(now)],
  );
  return (result.rowCount ?? 0) > 0;
}
