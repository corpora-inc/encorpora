import type { Pool } from "pg";
import { RETENTION } from "../privacy/retention-periods.js";

/** Below this much visible time, with no real input and no play, a browser that
 * loaded the pitch isn't counted as a person: scanners and link previews load
 * pages and follow links without staying. The raw count stays beside it. */
export const STAYED_MS = 3000;
/** A Buy or Try click sooner than this, with no real input, isn't a decision. */
export const TOO_FAST_MS = 1000;

/** Each person's furthest point, in order, for "where do they stop". */
const LADDER = [
  "stayed",
  "video_play",
  "video_seconds:3",
  "video_seconds:10",
  "video_seconds:20",
  "video_seconds:30",
  "video_progress:25",
  "video_progress:50",
  "video_progress:75",
  "video_progress:100",
  "chose",
  "account_session",
  "trial_problem_view",
  "problem_rendered",
  "invoice",
  "checkout_start",
  "purchase",
] as const;

export type FlowRow = {
  landed: number;
  stayed: number;
  /** Clicks with no time on the page and no input: see `TOO_FAST_MS`. */
  tooFast: number;
  medianStaySeconds: number | null;
  interacted: number;
  played: number;
  sawBuy: number;
  tried: number;
  buyCard: number;
  buyFunded: number;
  accounts: number;
  firstProblem: number;
  invoice: number;
  checkout: number;
  purchased: number;
  /** People passing each watch mark, seconds then percent. */
  watch: Record<string, number>;
};
type Visitor = {
  source: string;
  medium: string;
  campaign: string;
  creative: string;
  device: string;
  last_screen: string | null;
  visible: number;
  events: string[];
  mixes: string[] | null;
};
const WATCH = [
  "video_seconds:3",
  "video_seconds:10",
  "video_seconds:20",
  "video_seconds:30",
  "video_progress:25",
  "video_progress:50",
  "video_progress:75",
  "video_progress:100",
];
const INPUT = ["first_interaction:pointer", "first_interaction:key"];
const has = (v: Visitor, ...names: string[]) =>
  names.some((name) => v.events.includes(name));
const stayed = (v: Visitor) =>
  v.visible >= STAYED_MS || has(v, "video_play", ...INPUT);
const chose = (v: Visitor) =>
  has(v, "try_click", "buy_click:card", "buy_click:funded");
const tooFast = (v: Visitor) =>
  chose(v) && v.visible < TOO_FAST_MS && !has(v, "video_play", ...INPUT);

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
function row(visitors: Visitor[]): FlowRow {
  const people = visitors.filter(stayed);
  const count = (...names: string[]) =>
    people.filter((v) => has(v, ...names)).length;
  const stay = median(people.map((v) => v.visible));
  return {
    landed: visitors.length,
    stayed: people.length,
    tooFast: visitors.filter(tooFast).length,
    medianStaySeconds: stay === null ? null : Math.round(stay / 100) / 10,
    interacted: count(...INPUT),
    played: count("video_play"),
    sawBuy: count("pitch_buy_seen"),
    tried: count("try_click"),
    buyCard: count("buy_click:card"),
    buyFunded: count("buy_click:funded"),
    accounts: count("account_session"),
    // The separate free trial's view until it was retired; practice since.
    firstProblem: count("trial_problem_view", "problem_rendered"),
    invoice: people.filter((v) => has(v, "invoice")).length,
    checkout: count("checkout_start"),
    purchased: count("purchase"),
    watch: Object.fromEntries(WATCH.map((name) => [name, count(name)])),
  };
}
function groups(
  visitors: Visitor[],
  key: (v: Visitor) => string | readonly string[],
) {
  const found = new Map<string, Visitor[]>();
  for (const v of visitors) {
    const keys = key(v);
    for (const k of typeof keys === "string" ? [keys] : keys)
      found.set(k, [...(found.get(k) ?? []), v]);
  }
  return [...found]
    .map(([name, members]) => ({ name, ...row(members) }))
    .sort((a, b) => b.stayed - a.stayed || b.landed - a.landed);
}
const STAY_BUCKETS = [
  ["no time recorded", 0, 1],
  ["under 3 s", 1, 3000],
  ["3-10 s", 3000, 10_000],
  ["10-30 s", 10_000, 30_000],
  ["30 s-1 min", 30_000, 60_000],
  ["1-3 min", 60_000, 180_000],
  ["over 3 min", 180_000, Infinity],
] as const;

/**
 * The parent acquisition flow, one line per step: who landed on the pitch, who
 * stayed, how far they watched, what they chose and where they stopped. People
 * are browsers, and a browser's source is its first touch. No visitor or session
 * IDs leave this report.
 */
export async function flowReport(
  pool: Pool,
  { days, since }: { days: number; since?: Date },
) {
  if (!Number.isInteger(days) || days < 1 || days > RETENTION.funnelEventDays)
    throw new Error(`Days must be 1–${RETENTION.funnelEventDays}`);
  const client = await pool.connect();
  let visitors: Visitor[];
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='20s'");
    const range =
      "occurred_on >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - ($1::int-1)";
    visitors = (
      await client.query<Visitor>(
        `WITH cohort AS (
           SELECT DISTINCT e.visitor_id FROM amp_funnel_events e
           JOIN amp_funnel_visitors v USING(visitor_id)
           WHERE e.event='pitch_view' AND e.${range}
             AND v.traffic_kind NOT IN ('internal','automated')
             AND ($2::timestamptz IS NULL OR EXISTS (
               SELECT 1 FROM amp_visitor_journeys j
               WHERE j.visitor_id=e.visitor_id AND j.event='pitch_view' AND j.received_at>=$2))
         ), marks AS (
           SELECT e.visitor_id,array_agg(DISTINCT CASE
               WHEN e.event='video_progress' THEN 'video_progress:'||(e.props->>'percent')
               WHEN e.event='video_seconds' THEN 'video_seconds:'||(e.props->>'seconds')
               WHEN e.event='first_interaction' THEN 'first_interaction:'||(e.props->>'kind')
               WHEN e.event='buy_click' AND coalesce(e.props->>'from','pitch')='pitch'
                 THEN 'buy_click:'||(e.props->>'path')
               ELSE e.event END) AS events,
             array_agg(DISTINCT e.props->>'mix') FILTER (WHERE e.event='video_play' AND e.props ? 'mix') AS mixes
           FROM amp_funnel_events e JOIN cohort USING(visitor_id)
           WHERE e.${range} GROUP BY 1
         ), time AS (
           SELECT p.visitor_id,sum(p.visible_ms)::float8 AS visible,
             (array_agg(p.screen ORDER BY p.occurred_on DESC,p.ordinal DESC,p.page_id))[1] AS last_screen,
             bool_or(p.screen='invoice') AS invoice
           FROM amp_engagement_pages p JOIN cohort USING(visitor_id)
           WHERE p.${range} GROUP BY 1
         )
         SELECT coalesce(v.utm_source,v.referrer,'unknown') AS source,
           coalesce(v.utm_medium,'none') AS medium,
           coalesce(v.utm_campaign,'none') AS campaign,
           coalesce(v.utm_content,'none') AS creative,
           coalesce(v.device,'unknown') AS device,
           t.last_screen,coalesce(t.visible,0)::float8 AS visible,
           CASE WHEN t.invoice THEN m.events||'invoice'::text ELSE m.events END AS events,
           m.mixes
         FROM cohort c JOIN amp_funnel_visitors v USING(visitor_id)
         JOIN marks m USING(visitor_id) LEFT JOIN time t USING(visitor_id)`,
        [days, since ?? null],
      )
    ).rows;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  const people = visitors.filter(stayed);
  const furthest = new Map<string, number>(LADDER.map((name) => [name, 0]));
  for (const v of people) {
    const reached = [...LADDER]
      .reverse()
      .find((name) =>
        name === "stayed" ? true : name === "chose" ? chose(v) : has(v, name),
      )!;
    furthest.set(reached, furthest.get(reached)! + 1);
  }
  const lastScreens = new Map<string, number>();
  for (const v of people) {
    const name = v.last_screen ?? "unknown";
    lastScreens.set(name, (lastScreens.get(name) ?? 0) + 1);
  }
  return {
    days,
    since: since?.toISOString() ?? null,
    overall: row(visitors),
    bySource: groups(visitors, (v) => `${v.source} / ${v.medium}`),
    byDevice: groups(visitors, (v) => v.device),
    byMix: groups(
      visitors.filter((v) => v.mixes?.length === 1),
      (v) => v.mixes!,
    ),
    byCreative: groups(
      visitors.filter((v) => v.creative !== "none"),
      (v) => v.creative,
    ),
    stay: STAY_BUCKETS.map(([name, from, to]) => ({
      name,
      browsers: visitors.filter((v) => v.visible >= from && v.visible < to)
        .length,
    })),
    furthest: LADDER.map((step) => ({
      step,
      people: furthest.get(step) ?? 0,
    })),
    lastScreen: [...lastScreens]
      .map(([screen, count]) => ({ screen, people: count }))
      .sort((a, b) => b.people - a.people),
  };
}

const table = (
  header: string[],
  rows: (string | number | null)[][],
): string => {
  const text = [header, ...rows].map((cells) =>
    cells.map((cell) => String(cell ?? "—")),
  );
  const widths = header.map((_, i) =>
    Math.max(...text.map((cells) => cells[i].length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => (i ? cell.padStart(widths[i]) : cell.padEnd(widths[i])))
      .join("  ");
  return [
    line(text[0]),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...text.slice(1).map(line),
  ].join("\n");
};
const HEADER = [
  "",
  "Landed",
  "Stayed",
  "TooFast",
  "MedStay",
  "Input",
  "Played",
  "3s",
  "10s",
  "20s",
  "30s",
  "25%",
  "50%",
  "75%",
  "100%",
  "SawBuy",
  "Try",
  "Card",
  "Funded",
  "Acct",
  "Problem",
  "Invoice",
  "Chkout",
  "Bought",
];
const cells = (name: string, r: FlowRow) => [
  name,
  r.landed,
  r.stayed,
  r.tooFast,
  r.medianStaySeconds === null ? null : `${r.medianStaySeconds}s`,
  r.interacted,
  r.played,
  ...WATCH.map((step) => r.watch[step]),
  r.sawBuy,
  r.tried,
  r.buyCard,
  r.buyFunded,
  r.accounts,
  r.firstProblem,
  r.invoice,
  r.checkout,
  r.purchased,
];

export function formatFlowReport(
  report: Awaited<ReturnType<typeof flowReport>>,
) {
  const section = (
    title: string,
    rows: ({ name: string } & FlowRow)[],
  ): string =>
    rows.length
      ? `\n${title}\n${table(
          HEADER,
          rows.map((r) => cells(r.name, r)),
        )}`
      : "";
  return [
    `AMP acquisition flow, last ${report.days} day(s)${report.since ? `, landing since ${report.since}` : ""}`,
    `Stayed = ${STAYED_MS / 1000} s visible, or a play, or a tap or key. Steps after Stayed count only those people. TooFast = clicked within ${TOO_FAST_MS / 1000} s with no input. MedStay is visible time across screens.`,
    `\nOverall\n${table(HEADER, [cells("all", report.overall)])}`,
    section("By source / medium (first touch)", report.bySource),
    section("By device", report.byDevice),
    section("By mix (browsers that played one)", report.byMix),
    section("By creative", report.byCreative),
    `\nHow long browsers stayed\n${table(
      ["", "Browsers"],
      report.stay.map((r) => [r.name, r.browsers]),
    )}`,
    `\nWhere people stopped: the furthest step each reached\n${table(
      ["", "People"],
      report.furthest.map((r) => [r.step, r.people]),
    )}`,
    `\nLast screen seen (approximate across sessions)\n${table(
      ["", "People"],
      report.lastScreen.map((r) => [r.screen, r.people]),
    )}`,
  ].join("\n");
}
