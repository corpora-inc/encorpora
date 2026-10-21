import { createDatabasePool } from "../src/server/database.js";

/** Aggregate campaign report. No individual visitor/account data is emitted. */
const days = Number(process.argv[2] ?? 30);
if (!Number.isInteger(days) || days < 1 || days > 3650)
  throw new Error("Days must be 1–3650");
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  const activity = await pool.query(
    `SELECT day,state,program,campaign,source,medium,action,count
    FROM amp_campaign_daily WHERE day >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int
    ORDER BY day,campaign,source,medium,action`,
    [days - 1],
  );
  const funnel = await pool.query(
    `SELECT v.utm_source AS source,v.utm_medium AS medium,
    e.event,count(*)::int AS events FROM amp_funnel_events e
    JOIN amp_funnel_visitors v ON v.visitor_id=e.visitor_id
    WHERE v.utm_campaign='ar-efa-launch' AND e.occurred_on >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int
    AND e.event IN ('try_click','placement_done','purchase')
    GROUP BY v.utm_source,v.utm_medium,e.event ORDER BY 1,2,3`,
    [days - 1],
  );
  console.log(
    JSON.stringify(
      {
        definitions: {
          activity:
            "Daily page loads and link clicks, not unique people. Reloads and bots can count.",
          invoice_click:
            "Opening an email link, not an invoice request, approved order, or sale.",
          funnel:
            "Existing AMP first-touch campaign events. Purchase is server-verified. No cross-domain visitor join; campaign totals only. Existing visitors may retain an earlier campaign.",
        },
        activity: activity.rows,
        funnel: funnel.rows,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
