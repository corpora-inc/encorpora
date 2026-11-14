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
    const match =
      /^CREATE INDEX CONCURRENTLY (amp_[a-z0-9_]+) ON amp_[a-z0-9_]+\s*\([a-z0-9_,\s]+\)(?: WHERE [a-z0-9_]+\s*(?:>=|<=|>|<|=)\s*\d+)?$/i.exec(
        statement,
      );
    if (!match)
      throw new Error(`Unsupported concurrent index statement: ${statement}`);
    return { name: match[1]!.toLowerCase(), statement };
  });
}
export async function migrate(connectionString: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await migrateOnce(connectionString);
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
async function migrateOnce(connectionString: string) {
  const pool = createDatabasePool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  try {
    await client.query("SET lock_timeout='5s'");
    await client.query("SELECT pg_advisory_lock(91347022)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS amp_migrations (name text PRIMARY KEY, checksum text NOT NULL)",
    );
    const directory = new URL("../migrations/", import.meta.url);
    for (const name of (await readdir(directory))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(new URL(name, directory), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
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
      } else {
        await client.query("BEGIN");
        await client.query("SET LOCAL lock_timeout='5s'");
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
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(91347022)");
    client.release();
    await pool.end();
  }
}
if (process.argv[1]?.endsWith("migrate.ts")) {
  if (!process.env.AMP_DATABASE_URL)
    throw new Error("AMP_DATABASE_URL is required");
  await migrate(process.env.AMP_DATABASE_URL);
  console.log("AMP database migrations applied.");
}
