import { writeFile } from "node:fs/promises";
import { createDatabasePool } from "../src/server/database.js";
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--output" || !args[1]))
  throw new Error(
    "Usage: report:parent-feedback [--output new-private-file.json]",
  );
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  const totals = await pool.query(
    "SELECT context,program,count(*)::int AS count FROM amp_parent_feedback GROUP BY context,program ORDER BY context,program",
  );
  if (args[1]) {
    const messages = await pool.query(
      "SELECT created_at,context,program,message FROM amp_parent_feedback ORDER BY created_at DESC LIMIT 200",
    );
    // Exclusive creation refuses existing files/symlinks; raw messages never reach stdout.
    await writeFile(
      args[1],
      JSON.stringify({ totals: totals.rows, messages: messages.rows }, null, 2),
      { mode: 0o600, flag: "wx" },
    );
    console.log(JSON.stringify({ exported: messages.rowCount }));
  } else console.log(JSON.stringify({ totals: totals.rows }));
} finally {
  await pool.end();
}
