import {
  cleverSyncCandidates,
  runDueCleverSync,
} from "../src/schools/clever/worker.js";
import { pathToFileURL } from "node:url";
import { createDatabasePool } from "../src/server/database.js";
import {
  CleverClient,
  cleverApiVersion,
} from "../src/schools/clever/client.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { lmsConnectEnabled } from "../src/schools/clever/lms-config.js";
import { lmsPassFailed, runLmsPasses } from "./clever-lms.js";
import { runRequestAlertPass } from "../src/schools/request-alerts.js";
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
      // Events are on by default. `no-events` is the operator opt-out; it
      // survives later self-serve reconnects. `events` turns them back on.
      if (
        !districtId ||
        !tenantId ||
        (events && events !== "events" && events !== "no-events") ||
        rest.length > 3
      )
        throw new Error(
          "Usage: clever-sync.ts bind DISTRICT_ID TENANT_ID [events|no-events]",
        );
      return await registerCleverConnection(pool, {
        environment,
        districtId,
        tenantId,
        ...(events ? { eventsEnabled: events === "events" } : {}),
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
    const rows = await cleverSyncCandidates(
      pool,
      environment,
      rest[0] && rest[0] !== "all" ? rest[0] : null,
    );
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
    const scheduled =
      (!rest[0] || rest[0] === "all") && (!rest[1] || rest[1] === "auto");
    // The scheduled pass also returns LMS grades, after rosters are current,
    // once LMS Connect is enabled for the app.
    const lms =
      scheduled && lmsConnectEnabled(env)
        ? await runLmsPasses(pool, env)
        : null;
    if (lms && lmsPassFailed(lms)) process.exitCode = 1;
    // And tells the operator about schools waiting for an invitation
    // (docs/clever-anyschool.md). A failed alert never stops a sync.
    let alerts:
      | Awaited<ReturnType<typeof runRequestAlertPass>>
      | { error: string }
      | null = null;
    if (scheduled)
      try {
        alerts = await runRequestAlertPass(pool, env);
        if ("failed" in alerts && alerts.failed) process.exitCode = 1;
      } catch (error) {
        console.error("[schools] operator alert pass failed", {
          message: (error as Error).message,
        });
        alerts = { error: "alert_pass_failed" };
        process.exitCode = 1;
      }
    return [
      ...results,
      ...(lms ? [{ lms }] : []),
      ...(alerts && !("due" in alerts && !alerts.due) ? [{ alerts }] : []),
    ];
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
