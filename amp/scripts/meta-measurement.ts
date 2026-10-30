import {
  metaDeliveryConfigSchema,
  metaMeasurementBatch,
  metaMeasurementReport,
} from "../src/advertising/meta-delivery.js";
import { metaMeasurementCredentials } from "../src/advertising/meta-credentials.js";
import { readPrivateMeasurementJson } from "../src/advertising/google-credentials.js";
import { createDatabasePool } from "../src/server/database.js";
import { providerSignupBatch } from "../src/advertising/provider-signups.js";

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
    console.log(
      JSON.stringify({
        signup: await providerSignupBatch(
          pool,
          {
            enabled: config.enabled && config.signupEnabled === true,
            provider: "meta",
            destinationId: config.destination.datasetId,
          },
          operation,
          limit,
          {
            accessToken: async () => {
              const path = process.env.AMP_META_MEASUREMENT_CREDENTIALS;
              if (!path) throw new Error("credentials_required");
              return metaMeasurementCredentials(path)();
            },
          },
        ),
      }),
    );
    if (operation === "report") {
      const report = await metaMeasurementReport(pool, config);
      console.log(
        JSON.stringify({
          enabled: config.enabled,
          ...report,
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
