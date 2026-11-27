/** Ends AMP sessions in bulk, for incident containment
 * (docs/incident-response.md, section 3):
 *
 *   npm run sessions:revoke -- --account <amp|user id> [--dry-run]
 *   npm run sessions:revoke -- --org <org id> [--dry-run]
 *   npm run sessions:revoke -- --all [--dry-run]
 *
 * Run it as a one-off Job from the `api` image, never inside a serving pod.
 * It needs only AMP_DATABASE_URL. Output is one JSON line of counts: no names,
 * emails, tokens or ids. `--dry-run` counts the same rows in a read-only
 * transaction and writes nothing. */
import { pathToFileURL } from "node:url";
import { createDatabasePool } from "../src/server/database.js";
import {
  parseRevokeArguments,
  revokeSessions,
  RevokeScopeError,
} from "../src/server/session-revocation.js";

export async function main(argv: readonly string[]) {
  const { scope, dryRun } = parseRevokeArguments(argv);
  if (!process.env.AMP_DATABASE_URL)
    throw new Error("AMP_DATABASE_URL is required");
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
    application_name: "amp-revoke-sessions",
  });
  try {
    const counts = await revokeSessions(pool, scope, { dryRun });
    console.log(JSON.stringify({ scope: scope.kind, dryRun, ...counts }));
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main(process.argv.slice(2)).catch((error: unknown) => {
    if (error instanceof RevokeScopeError) {
      console.error(error.message);
      process.exitCode = 2;
    } else {
      console.error("Sessions not revoked:", error);
      process.exitCode = 1;
    }
  });
