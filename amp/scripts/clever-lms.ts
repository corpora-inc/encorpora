import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { createDatabasePool } from "../src/server/database.js";
import { CleverClient } from "../src/schools/clever/client.js";
import { LmsClient } from "../src/schools/clever/lms-client.js";
import {
  lmsConnectEnabled,
  lmsOrigin,
} from "../src/schools/clever/lms-config.js";
import {
  lmsCandidates,
  runLmsConnection,
  type LmsPassResult,
} from "../src/schools/clever/lms-worker.js";
import { safeSyncError } from "../src/schools/clever/sync.js";

/** One LMS pass over every active district connection, or one connection.
 * Output holds internal connection IDs, LMS state and counts only. */
export async function runLmsPasses(
  pool: Pool,
  env: NodeJS.ProcessEnv,
  connectionId: string | null = null,
  dependencies: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<(LmsPassResult | { connectionId: string; error: string })[]> {
  const environment = env.AMP_CLEVER_ENVIRONMENT;
  if (environment !== "sandbox" && environment !== "production")
    throw new Error("AMP_CLEVER_ENVIRONMENT must be sandbox or production");
  const origin = lmsOrigin(env);
  const clever = new CleverClient({
    clientId: env.AMP_CLEVER_CLIENT_ID ?? "",
    clientSecret: env.AMP_CLEVER_CLIENT_SECRET ?? "",
    apiVersion: "3.1",
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
  });
  const rows = (await lmsCandidates(pool, environment)).filter(
    (row) => connectionId === null || row.id === connectionId,
  );
  if (connectionId && !rows.length)
    throw new Error("Clever connection not found");
  const results = [];
  for (const row of rows) {
    try {
      results.push(
        await runLmsConnection(pool, row.id, {
          clever,
          lms: () =>
            new LmsClient(
              dependencies.fetch ? { fetch: dependencies.fetch } : {},
            ),
          origin,
          ...(dependencies.now ? { now: dependencies.now } : {}),
        }),
      );
    } catch (error) {
      results.push({ connectionId: row.id, error: safeSyncError(error) });
    }
  }
  return results;
}

/** A capability failure (401/403) or a worker error fails the job, so the
 * CronJob's status shows it; a teacher sees the same code on the assignment. */
export const lmsPassFailed = (
  results: Awaited<ReturnType<typeof runLmsPasses>>,
) =>
  results.some(
    (result) =>
      "error" in result ||
      Object.keys(result.failures).some((code) =>
        ["lms_unauthorized", "lms_forbidden", "lms_worker_failed"].includes(
          code,
        ),
      ),
  );

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [command, target, ...rest] = process.argv.slice(2);
  if (command !== "run" || rest.length) {
    console.error("Usage: clever-lms.ts run [CONNECTION_ID|all]");
    process.exitCode = 2;
  } else if (!lmsConnectEnabled(process.env)) {
    console.log(JSON.stringify({ lmsConnect: "disabled" }));
  } else {
    if (!process.env.AMP_DATABASE_URL)
      throw new Error("AMP_DATABASE_URL is required");
    const pool = createDatabasePool({
      connectionString: process.env.AMP_DATABASE_URL,
    });
    try {
      const results = await runLmsPasses(
        pool,
        process.env,
        target && target !== "all" ? target : null,
      );
      console.log(JSON.stringify(results));
      if (lmsPassFailed(results)) process.exitCode = 1;
    } catch (error) {
      console.error(safeSyncError(error));
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
}
