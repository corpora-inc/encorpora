import { Pool } from "pg";
import { consentConfiguration } from "../src/parent-consent/config.js";
import { ConsentRepository } from "../src/parent-consent/repository.js";
import { ResendConsentTransport } from "../src/parent-consent/resend.js";
import { deliverConsentMail } from "../src/parent-consent/worker.js";

// A scheduler invokes this bounded job. No background sender runs in the API.
let pool: Pool | undefined;
try {
  if (!process.env.AMP_DATABASE_URL) throw new Error("Missing database");
  const config = await consentConfiguration(process.env);
  if (!config.delivery || !config.transportEnabled)
    throw new Error("Delivery disabled");
  pool = new Pool({
    connectionString: process.env.AMP_DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
  const repository = new ConsentRepository(
    pool,
    config.policy,
    config.secrets,
    true,
  );
  const transport = new ResendConsentTransport(config.delivery);
  let processed = 0;
  while (processed < 8 && (await deliverConsentMail(repository, transport)))
    processed++;
  console.log(JSON.stringify({ event: "consent-delivery-job", processed }));
} catch {
  console.error(
    "Consent delivery job stopped. Check private configuration and delivery status.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
