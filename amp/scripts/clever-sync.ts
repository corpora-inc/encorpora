import { runDueCleverSync } from "../src/schools/clever/worker.js";
import { pathToFileURL } from "node:url";
import { createDatabasePool } from "../src/server/database.js";
import {
  CleverClient,
  cleverApiVersion,
} from "../src/schools/clever/client.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import {
  safeSyncError,
  syncCleverConnection,
  type SyncMode,
} from "../src/schools/clever/sync.js";

/** Runs one bounded pass; a scheduler may invoke this daily and on demand.
 * Secrets are environment-only. Outputs contain counts and internal IDs only. */
export async function cleverSyncCommand(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const [command, ...rest] = args;
  if (!env.AMP_DATABASE_URL) throw new Error("AMP_DATABASE_URL is required");
  const environment = env.AMP_CLEVER_ENVIRONMENT;
  if (environment !== "sandbox" && environment !== "production")
    throw new Error("AMP_CLEVER_ENVIRONMENT must be sandbox or production");
  const pool = createDatabasePool({ connectionString: env.AMP_DATABASE_URL });
  try {
    if (command === "bind") {
      const [districtId, tenantId, events] = rest;
      if (
        !districtId ||
        !tenantId ||
        (events && events !== "events") ||
        rest.length > 3
      )
        throw new Error(
          "Usage: clever-sync.ts bind DISTRICT_ID TENANT_ID [events]",
        );
      return await registerCleverConnection(pool, {
        environment,
        districtId,
        tenantId,
        ...(events === "events" ? { eventsEnabled: true } : {}),
      });
    }
    if (
      command !== "sync" ||
      rest.length > 2 ||
      (rest[1] && !["auto", "full", "events"].includes(rest[1]))
    )
      throw new Error(
        "Usage: clever-sync.ts sync [CONNECTION_ID|all] [auto|full|events]",
      );
    const client = new CleverClient({
      clientId: env.AMP_CLEVER_CLIENT_ID ?? "",
      clientSecret: env.AMP_CLEVER_CLIENT_SECRET ?? "",
      apiVersion: cleverApiVersion(env.AMP_CLEVER_API_VERSION),
    });
    const rows = (
      await pool.query(
        `SELECT id FROM amp_clever_connections WHERE environment=$1 AND status='active' AND (NOT sync_paused OR sync_requested_at IS NOT NULL OR $2::text IS NOT NULL)
      AND ($2::text IS NULL OR id::text=$2) ORDER BY created_at,id`,
        [environment, rest[0] && rest[0] !== "all" ? rest[0] : null],
      )
    ).rows;
    if (rest[0] && rest[0] !== "all" && !rows.length)
      throw new Error("Clever connection not found");
    const results = [];
    for (const row of rows) {
      try {
        results.push({
          connectionId: row.id,
          ...((!rest[0] || rest[0] === "all") &&
          (!rest[1] || rest[1] === "auto")
            ? await runDueCleverSync(pool, row.id, client)
            : await syncCleverConnection(pool, row.id, client, {
                mode: rest[1] as SyncMode | undefined,
              })),
        });
      } catch (error) {
        results.push({ connectionId: row.id, error: safeSyncError(error) });
      }
    }
    if (results.some((result) => "error" in result)) process.exitCode = 1;
    return results;
  } finally {
    await pool.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(JSON.stringify(await cleverSyncCommand(process.argv.slice(2))));
  } catch (error) {
    console.error(safeSyncError(error));
    process.exitCode = 1;
  }
}
