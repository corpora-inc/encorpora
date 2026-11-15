import type { PoolClient } from "pg";
import { concurrentIndexes } from "../../scripts/migrate.js";

/** Historical fixtures apply selected migrations without the runner's receipts.
 * Concurrent index files still require one autocommit query per statement. */
export async function applyFixtureMigration(
  db: Pick<PoolClient, "query">,
  sql: string,
) {
  const indexes = concurrentIndexes(sql);
  if (indexes) {
    for (const index of indexes) await db.query(index.statement);
  } else {
    await db.query(sql);
  }
}
