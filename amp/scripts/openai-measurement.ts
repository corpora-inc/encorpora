import { readFile, lstat } from "node:fs/promises";
import { createDatabasePool } from "../src/server/database.js";
import { readPrivateMeasurementJson } from "../src/advertising/google-credentials.js";
import { providerSignupBatch } from "../src/advertising/provider-signups.js";
import {
  openaiDeliveryConfigSchema,
  openaiDestinationKey,
  openaiMeasurementBatch,
} from "../src/advertising/openai-delivery.js";
async function main() {
  const operation = process.argv[2] ?? "report",
    limit = Number(process.argv[3] ?? 20);
  if (
    !["report", "collect", "deliver"].includes(operation) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    process.argv.length > 4
  )
    throw new Error();
  const path = process.env.AMP_OPENAI_MEASUREMENT_CONFIG;
  if (!path || !process.env.AMP_DATABASE_URL) throw new Error();
  const config = openaiDeliveryConfigSchema.parse(
    await readPrivateMeasurementJson(path),
  );
  if (operation !== "report" && !config.enabled) {
    console.log(JSON.stringify({ disabled: true }));
    return;
  }
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  try {
    const runtime = {
      accessToken: async () => {
        const key = process.env.AMP_OPENAI_MEASUREMENT_KEY;
        if (!key) throw new Error();
        const info = await lstat(key);
        if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size > 8192)
          throw new Error();
        return (await readFile(key, "utf8")).trim();
      },
    };
    console.log(
      JSON.stringify({
        signup: await providerSignupBatch(
          pool,
          {
            enabled: config.enabled && config.signupEnabled === true,
            provider: "openai",
            destinationId: config.pixelId,
          },
          operation,
          limit,
          runtime,
        ),
      }),
    );
    if (operation === "report") {
      const rows = await pool.query(
        "SELECT state,count(*)::int AS count FROM amp_openai_purchase_queue WHERE destination_key=$1 GROUP BY state ORDER BY state",
        [openaiDestinationKey(config)],
      );
      console.log(
        JSON.stringify({
          enabled: config.enabled,
          deliveries: rows.rows,
          meaning:
            "Accepted means receipt by OpenAI, not an attributed sale or net revenue.",
        }),
      );
    } else
      console.log(
        JSON.stringify(
          await openaiMeasurementBatch(
            pool,
            config,
            operation as "collect" | "deliver",
            limit,
            runtime,
          ),
        ),
      );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "OpenAI purchase measurement failed. Inspect private configuration and database health; no credentials or event payloads were logged.",
  );
  process.exitCode = 1;
});
