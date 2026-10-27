import { createDatabasePool } from "../src/server/database.js";
import { GoogleDataManager } from "../src/advertising/google-data-manager.js";
import {
  googleMeasurementCredentials,
  readPrivateMeasurementJson,
} from "../src/advertising/google-credentials.js";
import {
  collectSignupConversions,
  deliverSignupConversion,
  diagnoseSignupConversions,
  signupMeasurementConfig,
} from "../src/advertising/signup-measurement.js";
const path = process.env.AMP_GOOGLE_SIGNUP_CONFIG;
if (!path) throw new Error("Signup measurement configuration required");
const config = signupMeasurementConfig.parse(
  await readPrivateMeasurementJson(path),
);
if (config.enabled) {
  if (
    !process.env.AMP_DATABASE_URL ||
    !process.env.AMP_GOOGLE_MEASUREMENT_CREDENTIALS
  )
    throw new Error("Signup measurement runtime incomplete");
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
  try {
    const client = new GoogleDataManager(
      config.destination,
      googleMeasurementCredentials(
        process.env.AMP_GOOGLE_MEASUREMENT_CREDENTIALS,
      ),
    );
    const collected = await collectSignupConversions(pool, config);
    let delivered = 0;
    while (
      delivered < 20 &&
      (await deliverSignupConversion(pool, config, client))
    )
      delivered++;
    const checked = await diagnoseSignupConversions(pool, config, client);
    console.log(
      JSON.stringify({
        event: "signup-measurement",
        collected,
        delivered,
        checked,
      }),
    );
  } catch {
    console.error(
      "Signup measurement needs attention; inspect private queue and configuration.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
