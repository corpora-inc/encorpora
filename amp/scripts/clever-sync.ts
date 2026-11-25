import { pathToFileURL } from "node:url";
import { createDatabasePool } from "../src/server/database.js";
import { cleverWorkDue } from "../src/schools/clever/due.js";
import type { SyncMode } from "../src/schools/clever/sync.js";

/** The sync, Clever client and LMS code: about a thousand modules (the
 * roster import reaches the curriculum). Loaded only when there is work, so
 * the every-minute job with nothing due is one query. */
const heavy = async () => {
  const [worker, client, connection, lmsConfig, lms, sync] = await Promise.all([
    import("../src/schools/clever/worker.js"),
    import("../src/schools/clever/client.js"),
    import("../src/schools/clever/connection.js"),
    import("../src/schools/clever/lms-config.js"),
    import("./clever-lms.js"),
    import("../src/schools/clever/sync.js"),
  ]);
  return { ...worker, ...client, ...connection, ...lmsConfig, ...lms, ...sync };
};

/** Runs one bounded pass; a scheduler may invoke this daily and on demand.
 * Secrets are environment-only. Outputs contain counts and internal IDs only. */
export async function cleverSyncCommand(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  load: typeof heavy = heavy,
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
      const { registerCleverConnection } = await load();
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
    const scheduled =
      (!rest[0] || rest[0] === "all") && (!rest[1] || rest[1] === "auto");
    // One query says what the scheduled pass has to do. Any
    // AMP_CLEVER_LMS_CONNECT value counts as configured here, so a bad one
    // still fails where it always has.
    const due = scheduled
      ? await cleverWorkDue(pool, environment, !!env.AMP_CLEVER_LMS_CONNECT)
      : null;
    // First, so a long district sync never delays it: tell the operator about
    // schools waiting for an invitation (docs/clever-anyschool.md). A failed
    // alert never stops a sync.
    let alerts: Record<string, unknown> | null = null;
    if (due?.alerts)
      try {
        const { runRequestAlertPass } =
          await import("../src/schools/request-alerts.js");
        alerts = await runRequestAlertPass(pool, env);
        if ("failed" in alerts && alerts.failed) process.exitCode = 1;
      } catch (error) {
        console.error("[schools] operator alert pass failed", {
          message: (error as Error).message,
        });
        alerts = { error: "alert_pass_failed" };
        process.exitCode = 1;
      }
    const tail = alerts && alerts.due !== false ? [{ alerts }] : [];
    // Nothing else due: no sync code loaded, no Clever call, no LMS pass.
    if (due && !due.sync && !due.lms) return tail;
    const {
      CleverClient,
      cleverApiVersion,
      cleverSyncCandidates,
      lmsConnectEnabled,
      lmsPassFailed,
      runDueCleverSync,
      runLmsPasses,
      safeSyncError,
      syncCleverConnection,
    } = await load();
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
          ...(scheduled
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
    // The scheduled pass also returns LMS grades, after rosters are current,
    // once LMS Connect is enabled for the app.
    if (scheduled && lmsConnectEnabled(env)) {
      const lms = await runLmsPasses(pool, env);
      if (lmsPassFailed(lms)) process.exitCode = 1;
      return [...results, { lms }, ...tail];
    }
    return [...results, ...tail];
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
    const { safeSyncError } = await import("../src/schools/clever/sync.js");
    console.error(safeSyncError(error));
    process.exitCode = 1;
  }
}
