import type { Pool } from "pg";
import { z } from "zod";
import { createDatabasePool } from "../src/server/database.js";
import { loadConsentPolicy } from "../src/parent-consent/policy.js";
import { ResendConsentTransport } from "../src/parent-consent/resend.js";
import { deliverFundedActivationMail } from "../src/funding-purchase/activation-mail.js";

let pool: Pool | undefined;
try {
  if (
    !process.env.AMP_DATABASE_URL ||
    process.env.NODE_ENV !== "production" ||
    process.env.AMP_FUNDING_DELIVERY !== "resend" ||
    process.env.AMP_FUNDING_MAIL_TRACKING_DISABLED !== "true"
  )
    throw new Error("Funded notification delivery is not configured");
  const policy = await loadConsentPolicy(process.env.AMP_CONSENT_POLICY_FILE);
  if (!policy) throw new Error("Reviewed policy required");
  const apiKey = z
    .string()
    .regex(/^re_[A-Za-z0-9_-]{16,200}$/)
    .parse(process.env.AMP_MAIL_RESEND_API_KEY);
  const sender = z.email().max(254).parse(process.env.AMP_MAIL_FROM);
  const transport = new ResendConsentTransport({ apiKey, sender });
  pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
  let processed = 0;
  while (
    processed < 8 &&
    (await deliverFundedActivationMail(pool, transport, policy))
  )
    processed++;
  const exceptions = (
    await pool.query(
      "SELECT count(*)::int count FROM amp_funded_activation_outbox WHERE stopped_at IS NOT NULL",
    )
  ).rows[0].count;
  console.log(
    JSON.stringify({
      event: "funded-activation-delivery-job",
      processed,
      exceptions,
    }),
  );
} catch {
  console.error(
    "Funded notification delivery stopped. Check private configuration and outbox status.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
