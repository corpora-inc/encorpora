import { backfillFamilyIdentities } from "./backfill-family-identities.js";
import { createDatabasePool } from "../src/server/database.js";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

/** Opt-in, index-only migrations. The restricted grammar deliberately excludes
 * functions, quoted identifiers and arbitrary SQL; splitting their statements
 * would require a SQL parser. Ordinary migrations keep their atomic transaction. */
export function concurrentIndexes(sql: string) {
  if (!sql.startsWith("-- migrate:concurrent-indexes\n")) return null;
  const statements = sql
    .replace(/^--[^\n]*/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  if (!statements.length) throw new Error("Empty concurrent index migration");
  return statements.map((statement) => {
    // Optionally UNIQUE; an optional predicate of AND-ed column comparisons
    // with a number or IS [NOT] NULL tests.
    const condition = String.raw`[a-z0-9_]+\s*(?:(?:>=|<=|>|<|=)\s*\d+|\s+IS\s+(?:NOT\s+)?NULL)`;
    const match = new RegExp(
      String.raw`^CREATE (?:UNIQUE )?INDEX CONCURRENTLY (amp_[a-z0-9_]+) ON amp_[a-z0-9_]+\s*\([a-z0-9_,\s]+\)(?: WHERE ${condition}(?:\s+AND\s+${condition})*)?$`,
      "i",
    ).exec(statement);
    if (!match)
      throw new Error(`Unsupported concurrent index statement: ${statement}`);
    return { name: match[1]!.toLowerCase(), statement };
  });
}
/** Renumbered before release, each time main took the next number (its
 * 0125s, 0126 and 0127), so production never applied the earlier names. A
 * development or preview database that did keeps its schema: the receipt
 * moves to the new name when the file's content is unchanged. Latest earlier
 * name first. */
export const renamedMigrations: Readonly<Record<string, readonly string[]>> = {
  "0128-family-spaces.sql": [
    "0127-family-spaces.sql",
    "0126-family-spaces.sql",
    "0125-family-spaces.sql",
  ],
  "0129-course-start.sql": [
    "0128-course-start.sql",
    "0127-course-start.sql",
    "0126-course-start.sql",
  ],
  "0130-family-history-indexes.sql": [
    "0129-family-history-indexes.sql",
    "0128-family-history-indexes.sql",
    "0127-family-history-indexes.sql",
  ],
  "0131-family-display-name.sql": [
    "0130-family-display-name.sql",
    "0129-family-display-name.sql",
    "0128-family-display-name.sql",
  ],
  "0132-family-identity-fallback.sql": [
    "0131-family-identity-fallback.sql",
    "0130-family-identity-fallback.sql",
    "0129-family-identity-fallback.sql",
  ],
  "0133-family-discovery-index.sql": [
    "0132-family-discovery-index.sql",
    "0131-family-discovery-index.sql",
    "0130-family-discovery-index.sql",
  ],
  "0134-funded-term-schedule.sql": [
    "0133-funded-term-schedule.sql",
    "0132-funded-term-schedule.sql",
    "0131-funded-term-schedule.sql",
  ],
  "0135-level-practice.sql": [
    "0134-level-practice.sql",
    "0133-level-practice.sql",
    "0132-level-practice.sql",
  ],
  "0150-clever-portal-staff.sql": [
    "0149-clever-portal-staff.sql",
    "0148-clever-portal-staff.sql",
  ],
};
/** Applied files rewritten before release, with the checksums a development or
 * preview database may hold. Each earlier version reached the same schema
 * once the migrations after it run (0135 once built its index and validated
 * its check in one locking transaction; 0136 and 0137 now do that without
 * blocking learners, and are no-ops after it). The receipt takes the
 * current checksum. */
export const supersededChecksums: Readonly<Record<string, readonly string[]>> =
  {
    "0135-level-practice.sql": [
      "6df76247b87ee63b1b968d382ac2435479a0553b562e1c9c50fb5e714f50c88d",
    ],
    // Previews applied it with the event check before the backfill.
    "0139-activation-milestones.sql": [
      "09ce2fa07301bbb0e7e379876abca75329c052d3ad16d21f90717f02080db8a5",
    ],
  };
/** `lockTimeoutMs` bounds each transactional migration's wait for a table
 * lock; a concurrent index build waits for older transactions as long as they
 * run. Tests shorten it. */
export async function migrate(
  connectionString: string,
  { lockTimeoutMs = 5000 }: { lockTimeoutMs?: number } = {},
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await migrateOnce(connectionString, lockTimeoutMs);
    } catch (error) {
      if (
        attempt >= 2 ||
        !["55P03", "40P01"].includes((error as { code?: string }).code ?? "")
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}
/** How long a second runner waits for the first to finish migrating. */
const MIGRATION_LOCK_WAIT_MS = 15 * 60_000;
/**
 * Take the session migration lock without blocking inside a statement.
 * A runner that holds the lock may be building an index concurrently, and
 * that build waits for every transaction older than it, including another
 * runner's statement blocked on `pg_advisory_lock`: each would wait for the
 * other until Postgres aborts one as a deadlock. Polling with
 * `pg_try_advisory_lock` leaves no statement open between attempts.
 */
async function acquireMigrationLock(client: {
  query: (sql: string) => Promise<{ rows: { locked: boolean }[] }>;
}) {
  const deadline = Date.now() + MIGRATION_LOCK_WAIT_MS;
  for (let wait = 25; ; wait = Math.min(wait * 2, 100)) {
    const { rows } = await client.query(
      "SELECT pg_try_advisory_lock(91347022) AS locked",
    );
    if (rows[0]?.locked) return;
    if (Date.now() > deadline)
      throw new Error("Another migration runner held the lock too long");
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}
async function migrateOnce(connectionString: string, lockTimeoutMs: number) {
  const pool = createDatabasePool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  try {
    await client.query(`SET lock_timeout=${Math.trunc(lockTimeoutMs)}`);
    await acquireMigrationLock(client);
    await client.query(
      "CREATE TABLE IF NOT EXISTS amp_migrations (name text PRIMARY KEY, checksum text NOT NULL)",
    );
    const directory = new URL("../migrations/", import.meta.url);
    for (const name of (await readdir(directory))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(new URL(name, directory), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      // Applied under an earlier name: adopt that receipt. Its checksum is
      // still compared below, so a changed file fails as before.
      for (const earlier of renamedMigrations[name] ?? [])
        await client.query(
          `UPDATE amp_migrations SET name=$1 WHERE name=$2
             AND NOT EXISTS (SELECT 1 FROM amp_migrations WHERE name=$1)`,
          [name, earlier],
        );
      await client.query(
        "UPDATE amp_migrations SET checksum=$2 WHERE name=$1 AND checksum=ANY($3::text[])",
        [name, checksum, supersededChecksums[name] ?? []],
      );
      const old = await client.query(
        "SELECT checksum FROM amp_migrations WHERE name=$1",
        [name],
      );
      if (old.rows.length) {
        if (old.rows[0].checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      const indexes = concurrentIndexes(sql);
      if (indexes) {
        // Keep the session advisory lock across every autocommit statement.
        // A failed build can leave an INVALID index, and a crash can leave a
        // valid prefix without the migration receipt. Retry both safely.
        // A concurrent build waits for every older transaction to finish;
        // those waits are not lock contention to give up on.
        await client.query("SET lock_timeout=0");
        for (const index of indexes) {
          const existing = await client.query(
            "SELECT indisvalid FROM pg_index WHERE indexrelid=to_regclass($1)",
            [index.name],
          );
          if (existing.rows[0]?.indisvalid) continue;
          if (existing.rows.length)
            await client.query(`DROP INDEX CONCURRENTLY ${index.name}`);
          // One query per index: multiple statements in a single query would
          // create an implicit transaction, even without BEGIN.
          await client.query(index.statement);
        }
        await client.query(`SET lock_timeout=${Math.trunc(lockTimeoutMs)}`);
      } else {
        await client.query("BEGIN");
        await client.query(
          `SET LOCAL lock_timeout=${Math.trunc(lockTimeoutMs)}`,
        );
        await client.query(sql);
      }
      await client.query("INSERT INTO amp_migrations VALUES($1,$2)", [
        name,
        checksum,
      ]);
      if (!indexes) await client.query("COMMIT");
    }
    // Data work commits per account, after all DDL transactions have released
    // their table locks. The session migration lock serializes runners; a
    // failure leaves no receipt and the ordinary bounded retry resumes safely.
    const dataMigration = "data:family-identities-v1";
    if (
      !(
        await client.query("SELECT 1 FROM amp_migrations WHERE name=$1", [
          dataMigration,
        ])
      ).rowCount
    ) {
      await backfillFamilyIdentities(pool);
      await client.query("INSERT INTO amp_migrations VALUES($1,'v1')", [
        dataMigration,
      ]);
    }
  } catch (error) {
    // A dead connection can't roll back or unlock; the server already did
    // both. Report the original failure, not the cleanup's.
    await client
      .query("ROLLBACK")
      .catch((rollback) =>
        console.error("Migration rollback failed", rollback),
      );
    throw error;
  } finally {
    let broken: Error | undefined;
    try {
      await client.query("SELECT pg_advisory_unlock(91347022)");
    } catch (error) {
      broken = error as Error;
      console.error("Migration lock release failed", error);
    }
    client.release(broken);
    await pool.end();
  }
}
if (process.argv[1]?.endsWith("migrate.ts")) {
  if (!process.env.AMP_DATABASE_URL)
    throw new Error("AMP_DATABASE_URL is required");
  await migrate(process.env.AMP_DATABASE_URL);
  console.log("AMP database migrations applied.");
}
