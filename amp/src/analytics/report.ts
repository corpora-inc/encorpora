import type { Pool } from "pg";
import type { FunnelEvent } from "./events.js";
import { funnelDay } from "./repository.js";

/** The ordered path from first visit to paid practice. */
export const FUNNEL_STEPS = [
  "landing_view",
  "try_click",
  "placement_answer",
  "placement_done",
  "map_view",
  "practice_answer",
  "paywall_view",
  "plan_view",
  "plan_select",
  "checkout_start",
  "checkout_return",
  "purchase",
  "learner_added",
  "paid_practice_first",
] as const satisfies readonly FunnelEvent[];

export type FunnelStep = {
  event: (typeof FUNNEL_STEPS)[number];
  visitors: number;
  /** Share of the previous step's visitors who also reached this one. */
  fromPrevious: number | null;
  fromFirst: number | null;
  /** Previous step's visitors who did not reach this one. */
  dropOff: number;
};
export type Breakdown = {
  key: string;
  visitors: number;
  tried: number;
  purchased: number;
  conversion: number | null;
};
export type FunnelReport = {
  from: string;
  to: string;
  visitors: number;
  steps: FunnelStep[];
  unattributedPurchases: number;
  breakdowns: Record<
    "source" | "device" | "ageBand" | "gradeBand",
    Breakdown[]
  >;
  daysToPurchase: {
    purchasers: number;
    median: number | null;
    p75: number | null;
    buckets: { bucket: string; purchasers: number }[];
  };
  returnVisits: { returned: number; rate: number | null; within7Days: number };
  paywallDismissReasons: { reason: string; count: number }[];
  refunds: {
    purchases: number;
    refunds: number;
    fullRefunds: number;
    rate: number | null;
    requestedReasons: { reason: string; count: number }[];
  };
  archived: { event: string; count: number }[];
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/**
 * Aggregates only: every figure is a count or rate over visitors whose first
 * visit is in the UTC days [from, to). Billing events on those days count too.
 */
export async function funnelReport(
  pool: Pool,
  window: { from: Date; to: Date },
): Promise<FunnelReport> {
  const range = [funnelDay(window.from), funnelDay(window.to)];
  const cohort = `v.first_seen>=$1 AND v.first_seen<$2`;
  const q = async <T extends Record<string, unknown>>(
    sql: string,
    args = range,
  ) => (await pool.query<T>(sql, args)).rows;
  const [{ visitors }] = await q<{ visitors: number }>(
    `SELECT count(*)::int AS visitors FROM amp_funnel_visitors v WHERE ${cohort}`,
  );
  // Per visitor, the funnel steps reached; only counts leave this function.
  const paths = (
    await q<{ events: string[] }>(
      `SELECT array_agg(DISTINCT e.event) AS events
       FROM amp_funnel_events e JOIN amp_funnel_visitors v USING(visitor_id)
       WHERE ${cohort} AND (e.event<>'checkout_return' OR e.props->>'outcome'='success')
       GROUP BY e.visitor_id`,
    )
  ).map((r) => new Set(r.events));
  const reachedCount = (...events: string[]) =>
    paths.filter((path) => events.every((e) => path.has(e))).length;
  const first = reachedCount(FUNNEL_STEPS[0]);
  const steps: FunnelStep[] = FUNNEL_STEPS.map((event, i) => {
    const count = reachedCount(event);
    if (i === 0)
      return {
        event,
        visitors: count,
        fromPrevious: null,
        fromFirst: ratio(count, first),
        dropOff: 0,
      };
    const previous = reachedCount(FUNNEL_STEPS[i - 1]);
    const continued = reachedCount(FUNNEL_STEPS[i - 1], event);
    return {
      event,
      visitors: count,
      fromPrevious: ratio(continued, previous),
      fromFirst: ratio(count, first),
      dropOff: previous - continued,
    };
  });
  const [{ unattributed }] = await q<{ unattributed: number }>(
    `SELECT count(*)::int AS unattributed FROM amp_funnel_events
     WHERE event='purchase' AND visitor_id IS NULL AND occurred_on>=$1 AND occurred_on<$2`,
  );
  const breakdown = async (column: string) =>
    (
      await q<{
        key: string;
        visitors: number;
        tried: number;
        purchased: number;
      }>(
        `SELECT COALESCE(${column},'unknown') AS key,count(*)::int AS visitors,
           count(*) FILTER (WHERE EXISTS(SELECT 1 FROM amp_funnel_events e
             WHERE e.visitor_id=v.visitor_id AND e.event='try_click'))::int AS tried,
           count(*) FILTER (WHERE v.converted_on IS NOT NULL)::int AS purchased
         FROM amp_funnel_visitors v WHERE ${cohort}
         GROUP BY 1 ORDER BY visitors DESC,key`,
      )
    ).map((r) => ({ ...r, conversion: ratio(r.purchased, r.visitors) }));
  const breakdowns = {
    source: await breakdown("COALESCE(v.utm_source,v.referrer)"),
    device: await breakdown("v.device"),
    ageBand: await breakdown("v.age_band"),
    gradeBand: await breakdown("v.grade_band"),
  };
  const days = (
    await q<{ days: number }>(
      `SELECT (v.converted_on-v.first_seen)::int AS days
       FROM amp_funnel_visitors v WHERE ${cohort} AND v.converted_on IS NOT NULL ORDER BY 1`,
    )
  ).map((r) => r.days);
  const pct = (p: number) =>
    days.length
      ? days[Math.min(days.length - 1, Math.floor(p * days.length))]
      : null;
  const bucketOf = (d: number) =>
    d === 0
      ? "same day"
      : d === 1
        ? "1 day"
        : d <= 7
          ? "2–7 days"
          : d <= 30
            ? "8–30 days"
            : "31+ days";
  const bucketNames = [
    "same day",
    "1 day",
    "2–7 days",
    "8–30 days",
    "31+ days",
  ];
  const [returns] = await q<{ returned: number; within7: number }>(
    `SELECT count(*) FILTER (WHERE r.max_days>=1)::int AS returned,
       count(*) FILTER (WHERE r.min_days BETWEEN 1 AND 7)::int AS within7
     FROM (SELECT v.visitor_id,
       max((e.props->>'daysSinceFirstVisit')::int) AS max_days,
       min(NULLIF((e.props->>'daysSinceFirstVisit')::int,0)) AS min_days
       FROM amp_funnel_visitors v JOIN amp_funnel_events e USING(visitor_id)
       WHERE ${cohort} AND e.event='session_start' GROUP BY v.visitor_id) r`,
  );
  const reasons = (event: string) =>
    q<{ reason: string; count: number }>(
      `SELECT e.props->>'reason' AS reason,count(*)::int AS count
       FROM amp_funnel_events e WHERE e.event='${event}' AND e.occurred_on>=$1 AND e.occurred_on<$2
       GROUP BY 1 ORDER BY 2 DESC,1`,
    );
  const [billing] = await q<{
    purchases: number;
    refunds: number;
    full: number;
  }>(
    `SELECT count(*) FILTER (WHERE event='purchase')::int AS purchases,
       count(*) FILTER (WHERE event='refund')::int AS refunds,
       count(*) FILTER (WHERE event='refund' AND props->>'full'='true')::int AS full
     FROM amp_funnel_events WHERE occurred_on>=$1 AND occurred_on<$2`,
  );
  const archived = await q<{ event: string; count: number }>(
    `SELECT event,sum(count)::int AS count FROM amp_funnel_aggregates
     WHERE month>=date_trunc('month',$1::date) AND month<$2::date GROUP BY 1 ORDER BY 1`,
  );
  return {
    from: range[0],
    to: range[1],
    visitors,
    steps,
    unattributedPurchases: unattributed,
    breakdowns,
    daysToPurchase: {
      purchasers: days.length,
      median: pct(0.5),
      p75: pct(0.75),
      buckets: bucketNames.map((bucket) => ({
        bucket,
        purchasers: days.filter((d) => bucketOf(d) === bucket).length,
      })),
    },
    returnVisits: {
      returned: returns.returned,
      rate: ratio(returns.returned, visitors),
      within7Days: returns.within7,
    },
    paywallDismissReasons: await reasons("paywall_dismiss"),
    refunds: {
      purchases: billing.purchases,
      refunds: billing.refunds,
      fullRefunds: billing.full,
      rate: ratio(billing.refunds, billing.purchases),
      requestedReasons: await reasons("refund_requested"),
    },
    archived,
  };
}

const percent = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;
function table(headers: string[], rows: (string | number)[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length)),
  );
  const line = (cells: (string | number)[]) =>
    cells
      .map((c, i) =>
        i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]),
      )
      .join("  ");
  return [
    line(headers),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map(line),
  ].join("\n");
}

export function formatFunnelReport(report: FunnelReport): string {
  const out: string[] = [
    `AMP funnel, visitors first seen ${report.from} up to ${report.to}: ${report.visitors} visitors`,
    "",
    table(
      ["Step", "Visitors", "From previous", "From landing", "Lost"],
      report.steps.map((s) => [
        s.event,
        s.visitors,
        percent(s.fromPrevious),
        percent(s.fromFirst),
        s.dropOff,
      ]),
    ),
  ];
  if (report.unattributedPurchases)
    out.push(
      `Unattributed verified purchases: ${report.unattributedPurchases}`,
    );
  const titles = {
    source: "Source",
    device: "Device",
    ageBand: "Age band",
    gradeBand: "Placed grade",
  };
  for (const [key, rows] of Object.entries(report.breakdowns))
    out.push(
      "",
      table(
        [
          titles[key as keyof typeof titles],
          "Visitors",
          "Tried",
          "Purchased",
          "Conversion",
        ],
        rows.map((r) => [
          r.key,
          r.visitors,
          r.tried,
          r.purchased,
          percent(r.conversion),
        ]),
      ),
    );
  const d = report.daysToPurchase;
  out.push(
    "",
    `Days to purchase: ${d.purchasers} purchasers, median ${d.median ?? "—"}, 75th percentile ${d.p75 ?? "—"}`,
    table(
      ["Bucket", "Purchasers"],
      d.buckets.map((b) => [b.bucket, b.purchasers]),
    ),
    "",
    `Return visits: ${report.returnVisits.returned} (${percent(report.returnVisits.rate)}), ${report.returnVisits.within7Days} within 7 days`,
    "",
    table(
      ["Paywall dismissed because", "Count"],
      report.paywallDismissReasons.map((r) => [r.reason, r.count]),
    ),
    "",
    `Refunds: ${report.refunds.refunds} of ${report.refunds.purchases} purchases (${percent(report.refunds.rate)}), ${report.refunds.fullRefunds} full`,
    table(
      ["Refund requested because", "Count"],
      report.refunds.requestedReasons.map((r) => [r.reason, r.count]),
    ),
  );
  if (report.archived.length)
    out.push(
      "",
      table(
        ["Archived converted-visitor events", "Count"],
        report.archived.map((r) => [r.event, r.count]),
      ),
    );
  return out.join("\n");
}
