import { readFile, stat, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createDatabasePool } from "../src/server/database.js";
import { engagementReport } from "../src/analytics/engagement-report.js";
import { fundedJourneyReport } from "../src/analytics/funded-journey-report.js";
import { fundedCohortSummary } from "../src/analytics/funded-cohort.js";
import { funnelReport } from "../src/analytics/report.js";
import {
  acquisitionDashboard,
  type AcquisitionSnapshot,
} from "../src/analytics/acquisition-dashboard.js";
import { insightsReport } from "../src/analytics/insights.js";
import { adCostsSchema } from "../src/analytics/ad-costs.js";

const args = process.argv.slice(2);
const options = new Map<string, string>();
for (let i = 0; i < args.length; i += 2) {
  if (
    !["--days", "--output", "--costs"].includes(args[i]) ||
    !args[i + 1] ||
    options.has(args[i])
  )
    throw new Error(
      "Usage: report:acquisition --output /private/report.html [--days 7] [--costs /private/costs.json]",
    );
  options.set(args[i], args[i + 1]);
}
const days = Number(options.get("--days") ?? 7);
if (!Number.isInteger(days) || days < 1 || days > 90)
  throw new Error("Days must be 1–90");
if (!options.get("--output"))
  throw new Error("A private HTML output path is required");
const output = resolve(options.get("--output")!);
if (!output.endsWith(".html")) throw new Error("Output must end in .html");
const costsPath = options.get("--costs");
if (costsPath && (await stat(costsPath)).size > 2_000_000)
  throw new Error("Cost snapshot is too large");
const costs = adCostsSchema.parse(
  costsPath ? JSON.parse(await readFile(costsPath, "utf8")) : { sources: [] },
);
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
const to = new Date();
to.setUTCHours(0, 0, 0, 0);
to.setUTCDate(to.getUTCDate() + 1);
const from = new Date(to.getTime() - days * 86400000);
try {
  const engagement = await engagementReport(pool, days);
  const funded = await fundedJourneyReport(pool, days);
  const funnel = await funnelReport(pool, { from, to });
  const learning = await insightsReport(
    pool,
    { from, to },
    { newest: 0, notes: false },
  );
  const fulfillment = [];
  for (const campaign of ["ar-efa-launch", "az-esa-launch"] as const)
    fulfillment.push(await fundedCohortSummary(pool, days, campaign));
  const feedback = (
    await pool.query<{
      context: string;
      program: string | null;
      count: number;
    }>(
      "SELECT context,program,count(*)::int AS count FROM amp_parent_feedback WHERE created_at >= $1 AND created_at < $2 GROUP BY 1,2 ORDER BY 3 DESC,1,2",
      [from, to],
    )
  ).rows;
  const snapshot: AcquisitionSnapshot = {
    generatedAt: new Date().toISOString(),
    days,
    engagement,
    funded,
    funnel,
    learning,
    fulfillment,
    feedback,
    costs,
  };
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  for (const [path, content] of [
    [output, acquisitionDashboard(snapshot)],
    [
      output.replace(/\.html$/, ".json"),
      JSON.stringify(snapshot, null, 2) + "\n",
    ],
  ]) {
    const temp = path + "." + randomUUID() + ".tmp";
    await writeFile(temp, content, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temp, path);
  }
  console.log(`Wrote private acquisition report: ${output}`);
} finally {
  await pool.end();
}
