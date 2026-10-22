import {
  googleDeliveryConfigSchema,
  googleMeasurementBatch,
  diagnoseGooglePayment,
} from "../src/advertising/google-delivery.js";
import {
  googleMeasurementCredentials,
  readPrivateMeasurementJson,
} from "../src/advertising/google-credentials.js";
import { createDatabasePool } from "../src/server/database.js";

// No event payloads, email, source IDs, tokens or receipt IDs in stdout/stderr.
async function main() {
  const operation = process.argv[2] ?? "report";
  const limit = Number(process.argv[3] ?? 20);
  if (
    !["collect", "deliver", "diagnostics", "report"].includes(operation) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    process.argv.length > 4
  )
    throw new Error("invalid_arguments");
  const path = process.env.AMP_GOOGLE_MEASUREMENT_CONFIG;
  if (!path) throw new Error("measurement_config_required");
  const config = googleDeliveryConfigSchema.parse(
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
      const { googleConversionDestinationKey } =
        await import("../src/advertising/google-data-manager.js");
      const key = googleConversionDestinationKey(config.destination);
      const preparations = await pool.query(
        "SELECT state,count(*)::int AS count FROM amp_google_purchase_queue WHERE destination_key=$1 GROUP BY state ORDER BY state",
        [key],
      );
      const attempts = await pool.query(
        `SELECT a.kind,a.state,a.processing,count(*)::int AS count FROM amp_google_delivery_attempts a
        JOIN amp_google_purchase_queue q USING(transaction_id) WHERE q.destination_key=$1 GROUP BY a.kind,a.state,a.processing ORDER BY a.kind,a.state,a.processing`,
        [key],
      );
      console.log(
        JSON.stringify({
          enabled: config.enabled,
          preparations: preparations.rows,
          attempts: attempts.rows,
          meaning:
            "Attempt counts are not unique purchases, attributed sales or reconciled net revenue. Uncertain/rejected submissions require review; success means processing only.",
        }),
      );
    } else if (operation === "collect")
      console.log(
        JSON.stringify(
          await googleMeasurementBatch(pool, config, "collect", limit),
        ),
      );
    else {
      const credentialPath = process.env.AMP_GOOGLE_MEASUREMENT_CREDENTIALS;
      if (!credentialPath) throw new Error("credentials_required");
      const runtime = {
        accessToken: googleMeasurementCredentials(credentialPath),
      };
      if (operation === "deliver")
        console.log(
          JSON.stringify(
            await googleMeasurementBatch(
              pool,
              config,
              "deliver",
              limit,
              runtime,
            ),
          ),
        );
      else {
        const counts: Record<string, number> = {};
        for (let i = 0; i < limit; i++) {
          const outcome = await diagnoseGooglePayment(pool, config, runtime);
          counts[outcome] = (counts[outcome] ?? 0) + 1;
          if (outcome === "idle") break;
        }
        console.log(JSON.stringify(counts));
      }
    }
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Google measurement command failed; inspect private configuration and database health. No payload or credential details were logged.",
  );
  process.exitCode = 1;
});
