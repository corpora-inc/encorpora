/* Refresh each learner's latest stored level day to the current estimator.

   A level day stores what the learner was shown (`levelDayDocument`). Class
   maps, teacher records and today's reports read the latest one as the
   learner's current level. When the estimator changes (its policy version),
   an older latest day goes on showing the old estimate until the learner
   answers again, while their own readout already shows the new one. This
   rewrites each such latest day with the learner's current level under the
   current policy, so every view shows one value. Earlier days stay as they
   were shown on the day, labelled with their own policy version: they are a
   record of what was shown, and term and growth reads use them as such.

   Dry run by default: reads only and prints counts by policy version.

     AMP_DATABASE_URL=... tsx scripts/refresh-level-days.ts
     AMP_DATABASE_URL=... tsx scripts/refresh-level-days.ts --apply --journal <file>
     AMP_DATABASE_URL=... tsx scripts/refresh-level-days.ts --revert <file>

   --apply writes the journal (each row's learner, day and previous document
   and version) before it changes anything, and each update only applies
   while the row still holds what it read. --revert puts the previous
   document back wherever the row still holds the refreshed one. The journal
   names learners: keep it private, outside any repository. */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { DEFAULT_FRONTIER_POLICY } from "../src/learning/frontier-policy.js";
import { createDatabasePool } from "../src/server/database.js";
import { levelDayDocument, PgTransaction } from "../src/server/repository.js";

type Stale = {
  learnerId: string;
  day: string;
  policyVersion: string;
  frontier: unknown;
};
export type LevelDayChange = Stale & { to: unknown; toVersion: string };

/** Each learner's latest level day whose policy is not the current one. */
export async function staleLatestDays(pool: Pool): Promise<Stale[]> {
  const { rows } = await pool.query(
    `SELECT learner_id AS "learnerId",day::text AS day,policy_version AS "policyVersion",frontier
     FROM (SELECT DISTINCT ON (learner_id) learner_id,day,policy_version,frontier
           FROM amp_level_days ORDER BY learner_id,day DESC) latest
     WHERE policy_version IS DISTINCT FROM $1`,
    [DEFAULT_FRONTIER_POLICY.version],
  );
  return rows;
}

/** The refreshed document for each stale latest day: the learner's current
 * level under the current policy, as `saveLevelDay` would store it today. */
export async function refreshedDays(
  pool: Pool,
  stale: readonly Stale[],
): Promise<LevelDayChange[]> {
  const changes: LevelDayChange[] = [];
  for (const row of stale) {
    const client = await pool.connect();
    try {
      // Rolled back: reading the level may checkpoint the stored state.
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT * FROM amp_learners WHERE id=$1",
        [row.learnerId],
      );
      if (!found.rowCount) continue;
      const tx = new PgTransaction(
        client,
        row.learnerId,
        undefined,
        found.rows[0],
      );
      changes.push({
        ...row,
        to: levelDayDocument(await tx.frontier()),
        toVersion: DEFAULT_FRONTIER_POLICY.version,
      });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }
  return changes;
}

/** Writes the refreshed rows, each only while it still holds what was read. */
export async function applyRefresh(
  pool: Pool,
  changes: readonly LevelDayChange[],
): Promise<number> {
  let applied = 0;
  for (const change of changes) {
    const result = await pool.query(
      `UPDATE amp_level_days SET frontier=$4::jsonb,policy_version=$5
       WHERE learner_id=$1 AND day=$2::date AND policy_version IS NOT DISTINCT FROM $3
         AND frontier=$6::jsonb`,
      [
        change.learnerId,
        change.day,
        change.policyVersion,
        JSON.stringify(change.to),
        change.toVersion,
        JSON.stringify(change.frontier),
      ],
    );
    applied += result.rowCount ?? 0;
  }
  return applied;
}

/** Puts back each journaled row that still holds its refreshed document. */
export async function revertRefresh(
  pool: Pool,
  changes: readonly LevelDayChange[],
): Promise<number> {
  let reverted = 0;
  for (const change of changes) {
    const result = await pool.query(
      `UPDATE amp_level_days SET frontier=$4::jsonb,policy_version=$3
       WHERE learner_id=$1 AND day=$2::date AND policy_version=$5 AND frontier=$6::jsonb`,
      [
        change.learnerId,
        change.day,
        change.policyVersion,
        JSON.stringify(change.frontier),
        change.toVersion,
        JSON.stringify(change.to),
      ],
    );
    reverted += result.rowCount ?? 0;
  }
  return reverted;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const connectionString = process.env.AMP_DATABASE_URL;
  if (!connectionString) throw new Error("Set AMP_DATABASE_URL");
  const pool = createDatabasePool({ connectionString });
  try {
    const revert = flag("--revert");
    if (revert) {
      const changes = JSON.parse(await readFile(revert, "utf8"));
      process.stdout.write(
        `reverted ${await revertRefresh(pool, changes)} of ${changes.length}\n`,
      );
    } else {
      const stale = await staleLatestDays(pool);
      const byVersion: Record<string, number> = {};
      for (const row of stale)
        byVersion[row.policyVersion ?? "none"] =
          (byVersion[row.policyVersion ?? "none"] ?? 0) + 1;
      process.stdout.write(
        `${stale.length} latest days on another policy: ${JSON.stringify(byVersion)}\n`,
      );
      if (args.includes("--apply")) {
        const journal = flag("--journal");
        if (!journal) throw new Error("--apply needs --journal <file>");
        const changes = await refreshedDays(pool, stale);
        await writeFile(journal, JSON.stringify(changes));
        process.stdout.write(
          `refreshed ${await applyRefresh(pool, changes)} of ${changes.length}\n`,
        );
      }
    }
  } finally {
    await pool.end();
  }
}
