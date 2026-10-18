import { readFile } from "node:fs/promises";
import { createDatabasePool } from "../src/server/database.js";
import { installConsentPolicy } from "../src/parent-consent/policy.js";
if (!process.env.AMP_DATABASE_URL || !process.argv[2])
  throw new Error(
    "Set AMP_DATABASE_URL and pass a private reviewed policy JSON file.",
  );
const pool = createDatabasePool({ connectionString: process.env.AMP_DATABASE_URL });
try {
  const file = await readFile(process.argv[2]);
  if (file.length > 128 * 1024) throw new Error("Oversized policy");
  await installConsentPolicy(pool, JSON.parse(file.toString("utf8")));
  console.log("Consent deployment policy updated. No email was sent.");
} catch {
  console.error(
    "Consent policy update rejected. Validate the private file and database configuration.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
