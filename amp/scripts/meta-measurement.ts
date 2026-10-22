import {
  metaDeliveryConfigSchema,
  metaMeasurementBatch,
} from "../src/advertising/meta-delivery.js";
import { metaMeasurementCredentials } from "../src/advertising/meta-credentials.js";
import { readPrivateMeasurementJson } from "../src/advertising/google-credentials.js";
import { createDatabasePool } from "../src/server/database.js";

// Counts only: never print email, browser context, payloads, IDs or credentials.
async function main() {
  const operation = process.argv[2] ?? "report";
  const limit = Number(process.argv[3] ?? 20);
  if (
    !["collect", "deliver", "report"].includes(operation) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    process.argv.length > 4
  )
    throw new Error("invalid_arguments");
  const path = process.env.AMP_META_MEASUREMENT_CONFIG;
  if (!path) throw new Error("measurement_config_required");
  const config = metaDeliveryConfigSchema.parse(
    await readPrivateMeasurementJson(path),
  );
  if (operation !== "report" && !config.enabled) {
    console.log(JSON.stringify({ disabled: true }));
    return;
  }
  if (!process.env.AMP_DATABASE_URL) throw new Error("database_required");
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  try {
    if (operation === "report") {
      const preparations = await pool.query(
        "SELECT state,count(*)::int AS count FROM amp_meta_purchase_queue WHERE dataset_id=$1 AND namespace=$2 GROUP BY state ORDER BY state",
        [config.destination.datasetId, config.sources.stripeNamespace],
      );
      const attempts = await pool.query(
        `SELECT a.state,count(*)::int AS count,
        count(*) FILTER (WHERE (a.receipt->>'messageCount')::int>0)::int AS receipts_with_messages
        FROM amp_meta_delivery_attempts a JOIN amp_meta_purchase_queue q USING(event_id)
        WHERE q.dataset_id=$1 AND q.namespace=$2 GROUP BY a.state ORDER BY a.state`,
        [config.destination.datasetId, config.sources.stripeNamespace],
      );
      console.log(
        JSON.stringify({
          enabled: config.enabled,
          preparations: preparations.rows,
          attempts: attempts.rows,
          meaning:
            "Attempt counts are not unique purchases, matched or attributed sales, or net revenue. Accepted means Meta reported receiving one event. Messages and uncertain/rejected attempts require review. Later refunds do not reverse Meta attribution; use first-party cash reports.",
        }),
      );
    } else if (operation === "collect")
      console.log(
        JSON.stringify(
          await metaMeasurementBatch(pool, config, "collect", limit),
        ),
      );
    else {
      const credentialPath = process.env.AMP_META_MEASUREMENT_CREDENTIALS;
      if (!credentialPath) throw new Error("credentials_required");
      console.log(
        JSON.stringify(
          await metaMeasurementBatch(pool, config, "deliver", limit, {
            accessToken: metaMeasurementCredentials(credentialPath),
          }),
        ),
      );
    }
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Meta measurement command failed; inspect private configuration and database health. No payload or credential details were logged.",
  );
  process.exitCode = 1;
});
