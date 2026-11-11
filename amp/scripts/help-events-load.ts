/**
 * Load estimate for help events (migration 0111). Migrates a throwaway schema
 * in AMP_LOAD_DATABASE_URL, writes a million events for 10,000 synthetic
 * learners the way heartbeats do (and the rest in bulk), then times the
 * rollups and the report reads and prints their plans and sizes.
 *
 *   AMP_LOAD_DATABASE_URL=postgres://… npx tsx scripts/help-events-load.ts
 *
 * Never point it at a shared database: it creates and keeps schema `help_load`.
 */
import { Pool } from "pg";
import { migrate } from "./migrate.js";
import { helpEventsCte, helpWeeks } from "../src/schools/help-events.js";

const url = process.env.AMP_LOAD_DATABASE_URL;
if (!url) throw new Error("AMP_LOAD_DATABASE_URL is required");
const schema = "help_load";
const LEARNERS = 10_000;
const HEARTBEATS = 20_000;
const PER_HEARTBEAT = 5;
const TOTAL = 1_000_000;

const admin = new Pool({ connectionString: url, max: 1 });
await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
await admin.query(`CREATE SCHEMA ${schema}`);
await admin.end();
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const pool = new Pool({ connectionString: scoped.href, max: 4 });
const timed = async <T>(label: string, run: () => Promise<T>) => {
  const start = performance.now();
  const result = await run();
  console.log(`${label}: ${Math.round(performance.now() - start)} ms`);
  return result;
};

await pool.query(
  `INSERT INTO amp_learners(id,account_id,name,birth_year)
   SELECT 'learner-'||g,'amp|load-'||g,'Load '||g,2015 FROM generate_series(1,$1) g`,
  [LEARNERS],
);
const skills = ["count-to-20", "addition-within-20", "place-value", "fractions-equal-parts", "ratios"];
const kinds = ["lesson", "hint", "hint", "hint", "video", "example"];

// Heartbeats as practice sends them: one statement each, five events riding on it.
const perHeartbeat = await timed(
  `${HEARTBEATS.toLocaleString()} heartbeat statements × ${PER_HEARTBEAT} events`,
  async () => {
    const workers = Array.from({ length: 4 }, async (_, worker) => {
      for (let i = worker; i < HEARTBEATS; i += 4) {
        const learner = `learner-${(i % LEARNERS) + 1}`;
        const events = Array.from({ length: PER_HEARTBEAT }, (_, k) => ({
          kind: kinds[(i + k) % kinds.length],
          source: "practice",
          ref: "add-within-20",
          problem_id: null,
          step: kinds[(i + k) % kinds.length] === "hint" ? 1 : null,
          age_ms: k * 1000,
          skill_id: skills[(i + k) % skills.length],
        }));
        await pool.query(
          `WITH live AS (SELECT $1::text AS learner_id,'America/New_York'::text AS timezone),
           ${helpEventsCte(2)} SELECT 1`,
          [learner, JSON.stringify(events)],
        );
      }
    });
    await Promise.all(workers);
  },
);
void perHeartbeat;

// The rest in bulk over a school year, 100,000 rows a statement.
const bulk = TOTAL - HEARTBEATS * PER_HEARTBEAT;
await timed(`${bulk.toLocaleString()} more events in bulk`, async () => {
  for (let done = 0; done < bulk; done += 100_000)
    await pool.query(
      `INSERT INTO amp_help_events(learner_id,"at",day,kind,source,skill_id,ref,problem_id,step)
       SELECT 'learner-'||(1+(g%$2)),t,(t AT TIME ZONE 'America/New_York')::date,
         (ARRAY['lesson','hint','hint','hint','video','example'])[1+(g%6)]::amp_help_kind,'practice',
         (ARRAY['count-to-20','addition-within-20','place-value','fractions-equal-parts','ratios'])[1+(g%5)],
         'add-within-20',md5(g::text),CASE WHEN g%6 BETWEEN 1 AND 3 THEN 1 END
       FROM generate_series($1::bigint,$1::bigint+99999) g
       CROSS JOIN LATERAL (SELECT now()-make_interval(days=>(g%300)::int,secs=>(g%86400)::int) AS t) x`,
      [done, LEARNERS],
    );
});
await pool.query("VACUUM ANALYZE amp_help_events, amp_help_days, amp_learner_weeks");

const sizes = await pool.query(
  `SELECT relname AS table,n_live_tup::int AS rows,pg_size_pretty(pg_total_relation_size(relid)) AS total,
     round(pg_total_relation_size(relid)::numeric/GREATEST(n_live_tup,1))::int AS bytes_per_row
   FROM pg_stat_user_tables WHERE relname IN ('amp_help_events','amp_help_days','amp_learner_weeks') ORDER BY relname`,
);
console.table(sizes.rows);
// Live row widths, without the dead versions a burst of upserts leaves behind.
const widths = await pool.query(
  `SELECT 'amp_help_events' AS table,round(avg(pg_column_size(e.*)))::int AS row_bytes FROM amp_help_events e
   UNION ALL SELECT 'amp_help_days',round(avg(pg_column_size(d.*)))::int FROM amp_help_days d
   UNION ALL SELECT 'amp_learner_weeks',round(avg(pg_column_size(w.*)))::int FROM amp_learner_weeks w`,
);
console.table(widths.rows);
const indexes = await pool.query(
  `SELECT indexrelname AS index,pg_size_pretty(pg_relation_size(indexrelid)) AS size FROM pg_stat_user_indexes
   WHERE relname IN ('amp_help_events','amp_help_days') ORDER BY 1`,
);
console.table(indexes.rows);

// Nightly-equivalent: rebuilding every learner's weeks from the day rollup.
await timed("rebuild all help weeks from amp_help_days", () =>
  pool.query(
    `UPDATE amp_learner_weeks w SET lessons=s.l,hints=s.h,videos=s.v,examples=s.e FROM (
       SELECT learner_id,date_trunc('week',day)::date AS week,
         COALESCE(sum(opened) FILTER (WHERE kind='lesson'),0)::int AS l,COALESCE(sum(opened) FILTER (WHERE kind='hint'),0)::int AS h,
         COALESCE(sum(opened) FILTER (WHERE kind='video'),0)::int AS v,COALESCE(sum(opened) FILTER (WHERE kind='example'),0)::int AS e
       FROM amp_help_days GROUP BY 1,2) s
     WHERE w.learner_id=s.learner_id AND w.week=s.week`,
  ),
);

const mondays: string[] = (
  await pool.query(
    `SELECT to_char(d,'YYYY-MM-DD') AS w FROM generate_series(date_trunc('week',now()-interval '15 weeks'),now(),interval '1 week') d`,
  )
).rows.map((r) => r.w);
const members = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    learnerId: `learner-${i + 1}`,
    from: mondays[0]!,
    to: new Date().toISOString().slice(0, 10),
  }));
for (const [label, n] of [
  ["a class of 30, a term", 30],
  ["a school of 1,000, a term", 1000],
] as const) {
  await timed(`report read: ${label}`, () => helpWeeks(pool, members(n), mondays));
  const plan = await pool.query(
    `EXPLAIN (ANALYZE,BUFFERS,COSTS OFF)
     SELECT w.week,sum(w.lessons),sum(w.hints),sum(w.videos),sum(w.examples),sum(w.lesson_ms),sum(w.hint_ms)
     FROM unnest($1::text[],$2::date[],$3::date[]) AS m(learner_id,from_day,to_day)
     JOIN amp_learner_weeks w ON w.learner_id=m.learner_id
       AND w.week BETWEEN date_trunc('week',m.from_day)::date AND m.to_day AND w.week=ANY($4::date[])
     GROUP BY w.week`,
    [
      members(n).map((m) => m.learnerId),
      members(n).map((m) => m.from),
      members(n).map((m) => m.to),
      mondays,
    ],
  );
  console.log(`EXPLAIN ${label}\n${plan.rows.map((r) => r["QUERY PLAN"]).join("\n")}`);
}
const exportPlan = await pool.query(
  `EXPLAIN (ANALYZE,BUFFERS,COSTS OFF) SELECT * FROM amp_help_events WHERE learner_id='learner-42' ORDER BY "at"`,
);
console.log(`EXPLAIN one learner's events (export)\n${exportPlan.rows.map((r) => r["QUERY PLAN"]).join("\n")}`);
const purgePlan = await pool.query(
  `EXPLAIN (ANALYZE,BUFFERS,COSTS OFF) SELECT ctid FROM amp_help_events WHERE "at"<=now()-interval '280 days' LIMIT 2000`,
);
console.log(`EXPLAIN retention batch\n${purgePlan.rows.map((r) => r["QUERY PLAN"]).join("\n")}`);
await pool.end();
