import type { Pool } from "pg";
import { createDatabasePool } from "../src/server/database.js";
import { ensureFamilyIdentity } from "../src/family/identity.js";

/** One-off data migration after the schema migrations, before Family reads.
 * Keyset pages bound memory; each account commits separately. No DDL locks.
 * The account lock and deletion check serialize with deletion/approval writers.
 * Safe to restart from the beginning: published IDs never change. */
export async function backfillFamilyIdentities(pool: Pool, batchSize = 250) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000)
    throw new Error("batchSize must be between 1 and 1000");
  let visited = 0;
  for (const source of ["families", "learners"] as const) {
    let after = "";
    while (true) {
      const rows = (
        await pool.query<{
          key: string;
          account_id: string;
          eligible: boolean;
        }>(
          source === "families"
            ? "SELECT account_id AS key,account_id,true AS eligible FROM amp_families WHERE account_id>$1 ORDER BY account_id LIMIT $2"
            : "SELECT id AS key,account_id,NOT adult AND deleted_at IS NULL AS eligible FROM amp_learners WHERE id>$1 ORDER BY id LIMIT $2",
          [after, batchSize],
        )
      ).rows;
      if (!rows.length) break;
      for (const row of rows) {
        after = row.key;
        if (
          !row.eligible ||
          row.account_id.startsWith("school:") ||
          row.account_id.startsWith("trial:")
        )
          continue;
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SET LOCAL lock_timeout='2s'");
          await client.query("SET LOCAL statement_timeout='5s'");
          await client.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
            [row.account_id],
          );
          const eligible = await client.query(
            `SELECT 1 WHERE
            NOT EXISTS(SELECT 1 FROM amp_account_deletions WHERE account_id=$1)
            AND NOT EXISTS(SELECT 1 FROM amp_family_spaces WHERE account_id=$1)
            AND (EXISTS(SELECT 1 FROM amp_families WHERE account_id=$1)
              OR EXISTS(SELECT 1 FROM amp_learners WHERE account_id=$1 AND NOT adult AND deleted_at IS NULL))`,
            [row.account_id],
          );
          if (eligible.rowCount)
            await ensureFamilyIdentity(client, row.account_id);
          await client.query("COMMIT");
          visited++;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
    }
  }
  return visited;
}
if (process.argv[1]?.endsWith("backfill-family-identities.ts")) {
  if (!process.env.AMP_DATABASE_URL)
    throw new Error("AMP_DATABASE_URL is required");
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  try {
    await backfillFamilyIdentities(pool);
    console.log("Family identity backfill complete.");
  } finally {
    await pool.end();
  }
}
