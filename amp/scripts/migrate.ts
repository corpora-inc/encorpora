import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
export async function migrate(connectionString: string) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(91347022)");
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
      await client.query(sql);
      await client.query("INSERT INTO amp_migrations VALUES($1,$2)", [
        name,
        checksum,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
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
