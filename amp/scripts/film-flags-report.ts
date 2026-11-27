import { createDatabasePool } from "../src/server/database.js";
import { filmFlagReports } from "../src/feedback/film-flag-store.js";

/**
 * npm run report:film-flags [-- --film <film id>] [--days 30] [--newest 100] [--notes]
 *
 * "Report this film" reports as JSON, newest first: every film's, or one
 * film's (`--film multiply-fractions--sm`, the id in
 * src/content/films/manifest.json). Each has the film's id and edition, the
 * problem type and problem it was opened for, the moment (`seconds`, `at`),
 * the player layout, the reasons, who sent it (a learner, a trial, an adult
 * or a visitor), the client, viewport and both builds. No learner or account
 * identifier is printed. `--notes` adds the notes; it is the operator's view,
 * refused unless the output is an interactive terminal, so notes never land
 * in job log storage (as `report:insights --notes`).
 */
const args = process.argv.slice(2);
const value = (flag: string) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};
const days = Number(value("--days") ?? 30);
if (!Number.isInteger(days) || days < 1 || days > 3650)
  throw new Error("--days must be a whole number from 1 to 3650");
const newest = Number(value("--newest") ?? 100);
if (!Number.isInteger(newest) || newest < 1 || newest > 1000)
  throw new Error("--newest must be a whole number from 1 to 1000");
const filmId = value("--film");
if (
  filmId !== undefined &&
  !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9-]+)?$/.test(filmId)
)
  throw new Error("--film must be a film id, such as multiply-fractions--sm");
const notes = args.includes("--notes");
if (notes && !process.stdout.isTTY)
  throw new Error(
    "--notes prints viewers' notes: run it in an interactive terminal",
  );
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  const reports = await filmFlagReports(pool, {
    filmId,
    days,
    limit: newest,
    notes,
  });
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await pool.end();
}
