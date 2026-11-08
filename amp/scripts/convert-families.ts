import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { ensureFamilyClass } from "../src/family/family-class.js";
import { FamilyRepository } from "../src/family/repository.js";
import { createDatabasePool } from "../src/server/database.js";

/** Families are classes (docs/families.md). Converts every family that is
 * still waiting: a parent account with a live child learner who isn't on any
 * roster yet gets its family org and class, with every child a student of it.
 * A parent's next `/me` does the same for their own family; this finishes the
 * rest. Accounts whose only learners are adults are never touched.
 *
 *   AMP_DATABASE_URL=… npm run family:convert -- [--dry-run] [--batch 200]
 *
 * One transaction per family, under the account's exclusive learning lock,
 * so it runs safely beside live traffic and can be stopped and run again.
 * Prints one JSON line of counts, never a name or an account. */
export async function convertFamilies(
  pool: Pool,
  { batch = 200, dryRun = false }: { batch?: number; dryRun?: boolean } = {},
) {
  const families = new FamilyRepository(pool);
  const counts = {
    accounts: 0,
    familiesCreated: 0,
    childrenEnrolled: 0,
    failed: 0,
    dryRun,
  };
  let after = "";
  for (;;) {
    const { rows } = await pool.query<{ account_id: string }>(
      `SELECT DISTINCT l.account_id FROM amp_learners l
       WHERE l.deleted_at IS NULL AND NOT l.adult
         AND l.account_id NOT LIKE 'school:%' AND l.account_id NOT LIKE 'trial:%'
         AND NOT EXISTS(SELECT 1 FROM amp_people p WHERE p.learner_id=l.id)
         AND l.account_id>$1
       ORDER BY l.account_id LIMIT $2`,
      [after, batch],
    );
    if (!rows.length) break;
    for (const { account_id: accountId } of rows) {
      after = accountId;
      counts.accounts++;
      if (dryRun) continue;
      try {
        const result = await families.transaction(accountId, (client) =>
          ensureFamilyClass(client, pool, accountId, { converting: true }),
        );
        if (result?.created) counts.familiesCreated++;
        counts.childrenEnrolled += result?.enrolled ?? 0;
      } catch (error) {
        // Codes only: a message could quote a name.
        counts.failed++;
        console.error(
          JSON.stringify({
            error: "family_conversion_failed",
            code: (error as { code?: string }).code ?? null,
          }),
        );
      }
    }
  }
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (!process.env.AMP_DATABASE_URL)
    throw new Error("Set AMP_DATABASE_URL to the deployment's database.");
  const args = process.argv.slice(2);
  const at = args.indexOf("--batch");
  const batch = at >= 0 ? Number(args[at + 1]) : 200;
  if (!Number.isInteger(batch) || batch < 1 || batch > 5000)
    throw new Error("--batch takes a whole number from 1 to 5000.");
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  try {
    const counts = await convertFamilies(pool, {
      batch,
      dryRun: args.includes("--dry-run"),
    });
    console.log(JSON.stringify(counts));
    if (counts.failed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
