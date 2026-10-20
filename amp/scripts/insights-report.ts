import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDatabasePool } from "../src/server/database.js";
import {
  formatInsights,
  insightsCsv,
  insightsReport,
} from "../src/analytics/insights.js";

/**
 * npm run report:insights [-- --days 30] [--json | --csv <dir>] [--newest 20] [--notes]
 *
 * What learners get right, get wrong and skip, how they progress, and what
 * they report. Aggregates only, with no names or identifiers. `--notes` adds
 * report notes to the newest reports; it is the operator's view, refused
 * unless the output is an interactive terminal or a CSV directory, so notes
 * never land in job log storage.
 */
const args = process.argv.slice(2);
const value = (flag: string) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};
const days = Number(value("--days") ?? 30);
if (!Number.isInteger(days) || days < 1 || days > 3650)
  throw new Error("--days must be a whole number from 1 to 3650");
const newest = Number(value("--newest") ?? 20);
if (!Number.isInteger(newest) || newest < 0 || newest > 500)
  throw new Error("--newest must be a whole number from 0 to 500");
const csvDirectory = value("--csv");
const notes = args.includes("--notes");
if (notes && !csvDirectory && !process.stdout.isTTY)
  throw new Error(
    "--notes prints learners' notes: run it in an interactive terminal or with --csv <dir>",
  );
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const report = await insightsReport(pool, { from, to }, { notes, newest });
  if (csvDirectory) {
    await mkdir(csvDirectory, { recursive: true });
    for (const [name, text] of Object.entries(insightsCsv(report)))
      await writeFile(join(csvDirectory, name), text, { mode: 0o600 });
    console.log(
      `Wrote ${Object.keys(insightsCsv(report)).join(", ")} to ${csvDirectory}`,
    );
  } else
    console.log(
      args.includes("--json")
        ? JSON.stringify(report, null, 2)
        : formatInsights(report),
    );
} finally {
  await pool.end();
}
