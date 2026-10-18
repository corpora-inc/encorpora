import { createDatabasePool } from "../src/server/database.js";
import { stripeConfig } from "../src/billing/stripe/config.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { StripeBilling } from "../src/billing/stripe/service.js";
const config = stripeConfig(process.env);
if (!config || !process.env.AMP_DATABASE_URL)
  throw new Error("Enabled Stripe configuration and AMP_DATABASE_URL required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  const billing = new StripeBilling(
    new StripeRepository(pool, config),
    new StripeGateway(config),
  );
  const result = await billing.runBatch(
    Number(process.env.AMP_STRIPE_WORKER_BATCH ?? 20),
  );
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
