import {
  gaSignupConfigSchema,
  deliverGaSignup,
  purgeGaSignups,
} from "../src/analytics/ga-signups.js";
import { readPrivateMeasurementJson } from "../src/advertising/google-credentials.js";
import { createDatabasePool } from "../src/server/database.js";

async function main() {
  const operation = process.argv[2] ?? "report";
  if (!["report", "deliver"].includes(operation) || process.argv.length > 3)
    throw new Error("invalid_arguments");
  if (!process.env.AMP_DATABASE_URL) throw new Error("database_required");
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  try {
    if (operation === "deliver") {
      if (!process.env.AMP_GA_SIGNUP_CONFIG) throw new Error("config_required");
      const config = gaSignupConfigSchema.parse(
        await readPrivateMeasurementJson(process.env.AMP_GA_SIGNUP_CONFIG),
      );
      await purgeGaSignups(pool);
      for (let n = 0; n < 20 && (await deliverGaSignup(pool, config)); n++);
    }
    console.log(
      JSON.stringify({
        states: (
          await pool.query(
            "SELECT state,count(*)::int AS count FROM amp_ga_signup_exports GROUP BY state ORDER BY state",
          )
        ).rows,
      }),
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "GA signup command failed; inspect private configuration and database health. No payload or credential details logged.",
  );
  process.exitCode = 1;
});
