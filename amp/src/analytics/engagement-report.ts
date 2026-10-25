import type { Pool } from "pg";
import { RETENTION } from "../privacy/retention-periods.js";

/** Aggregate first-party observations. No visitor/session IDs leave the report. */
export async function engagementReport(pool: Pool, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > RETENTION.funnelEventDays)
    throw new Error(`Days must be 1–${RETENTION.funnelEventDays}`);
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await c.query("SET LOCAL statement_timeout='20s'");
    const range =
      "occurred_on >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - ($1::int-1)";
    const audience = "v.traffic_kind NOT IN ('internal','automated')";
    const q = async (sql: string) => (await c.query(sql, [days])).rows;
    const coverage = await q(`SELECT v.traffic_kind,count(*)::int AS browsers
      FROM amp_funnel_visitors v WHERE last_seen >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - ($1::int-1)
      GROUP BY 1 ORDER BY 1`);
    const screens = await q(`SELECT p.screen,count(*)::int AS page_visits,
      count(DISTINCT p.visitor_id)::int AS browsers,
      round(sum(p.active_ms)/1000.0,1)::float8 AS active_seconds,
      round(sum(p.visible_ms)/1000.0,1)::float8 AS visible_seconds,
      round(avg(p.active_ms)/1000.0,1)::float8 AS mean_active_seconds_per_page
      FROM amp_engagement_pages p JOIN amp_funnel_visitors v USING(visitor_id)
      WHERE p.${range} AND ${audience} GROUP BY 1 ORDER BY page_visits DESC,screen`);
    const sources =
      await q(`SELECT coalesce(v.utm_source,v.referrer,'unknown') AS source,
      coalesce(v.utm_campaign,'none') AS campaign,
      coalesce(v.utm_medium,'none') AS medium,coalesce(v.utm_content,'none') AS creative,count(DISTINCT p.visitor_id)::int AS browsers,
      count(DISTINCT (p.visitor_id,p.session_id))::int AS document_sessions,
      round(sum(p.active_ms)/1000.0,1)::float8 AS active_seconds
      FROM amp_engagement_pages p JOIN amp_funnel_visitors v USING(visitor_id)
      WHERE p.${range} AND ${audience} GROUP BY 1,2,3,4 ORDER BY browsers DESC,source,campaign,medium,creative`);
    const paths = await q(`WITH pages AS (
      SELECT p.visitor_id,p.session_id,p.screen,
        lead(p.screen) OVER(PARTITION BY p.visitor_id,p.session_id ORDER BY p.ordinal,p.page_id) AS next_screen
      FROM amp_engagement_pages p JOIN amp_funnel_visitors v USING(visitor_id)
      WHERE p.${range} AND ${audience})
      SELECT screen,coalesce(next_screen,'last_observed') AS next_screen,count(*)::int AS transitions
      FROM pages GROUP BY 1,2 ORDER BY transitions DESC,screen,next_screen`);
    const actions = await q(`SELECT a.screen,a.action,
      coalesce(v.utm_source,v.referrer,'unknown') AS source,coalesce(v.utm_medium,'none') AS medium,
      coalesce(v.utm_campaign,'none') AS campaign,coalesce(v.utm_content,'none') AS creative,
      count(*)::int AS actions,
      count(DISTINCT a.visitor_id)::int AS browsers
      FROM amp_journey_actions a JOIN amp_funnel_visitors v USING(visitor_id)
      WHERE a.${range} AND ${audience} GROUP BY 1,2,3,4,5,6 ORDER BY actions DESC,screen,action,source,medium,campaign,creative`);
    const purchaseAttempts = await q(`SELECT e.props->>'stage' AS stage,
      e.props->>'outcome' AS outcome,coalesce(e.props->>'failure','none') AS failure,
      coalesce(v.utm_source,v.referrer,'unknown') AS source,
      coalesce(v.utm_medium,'none') AS medium,coalesce(v.utm_campaign,'none') AS campaign,
      coalesce(v.utm_content,'none') AS creative,
      count(DISTINCT (e.visitor_id,e.props->>'attemptId'))::int AS attempts,
      count(DISTINCT e.visitor_id)::int AS browsers
      FROM amp_funnel_events e JOIN amp_funnel_visitors v USING(visitor_id)
      WHERE e.event='purchase_attempt' AND e.${range} AND ${audience}
      GROUP BY 1,2,3,4,5,6,7 ORDER BY attempts DESC,1,2,3,4,5,6,7`);
    const journeys = await q(`WITH pages AS (
      SELECT p.visitor_id,p.screen,
        lead(p.screen) OVER(PARTITION BY p.visitor_id ORDER BY p.visit_order) AS next_screen
      FROM amp_engagement_pages p JOIN amp_funnel_visitors v USING(visitor_id)
      WHERE p.${range} AND ${audience} AND p.visit_order IS NOT NULL)
      SELECT screen,coalesce(next_screen,'last_observed') AS next_screen,count(*)::int AS transitions
      FROM pages GROUP BY 1,2 ORDER BY transitions DESC,screen,next_screen`);
    await c.query("COMMIT");
    return {
      days,
      asOf: new Date().toISOString(),
      coverage,
      screens,
      sources,
      paths,
      actions,
      purchaseAttempts,
      journeys,
      definitions: [
        "Purchase attempts are client-observed requests grouped by stage and outcome. Repeated delivery of the same attempt/outcome counts once. A successful invoice, checkout or claim request does not prove payment. Missing terminal events may reflect navigation or failed delivery, not abandonment.",
        "Marketing actions are deduplicated by event ID; opening an invoice form is not invoice creation or payment. Marketing and AMP share an opaque first-party browser ID on HTTPS Corpora domains.",
        "Journeys cross document loads using the collector arrival order of first page snapshots. Concurrent tabs and delayed requests can change this observed order. Legacy pages without an arrival sequence are omitted from this view.",
        "Distinct browser IDs are not unique people. External means not marked internal or automated; it is not verified human traffic.",
        "Customer totals exclude browsers marked internal or automated. Unknown legacy traffic remains separately visible in coverage and may include staff/testing.",
        "One document load is one session; SPA navigation produces ordered page visits. A refresh starts another session. Source/campaign are browser first-touch labels.",
        "Visible time requires a visible, focused page. Active time stops 60 seconds after the last interaction. A newly opened page receives at most 60 seconds before further input is required. Timer gaps over 60 seconds count as suspend.",
        "Durations are cumulative snapshots, not exact attention measurements. Failed delivery can undercount; last_observed is not proof of abandonment. No historical durations are inferred.",
        "Engagement is first-party only and is not exported to advertising platforms. Screen categories exclude URL parameters, learner identities, answers, and form contents.",
      ],
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
