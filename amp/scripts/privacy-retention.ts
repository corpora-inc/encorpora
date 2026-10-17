import { purgeConsentRecords } from "../src/parent-consent/lifecycle.js";
import { purgeExpiredFundingRequests } from "../src/funding-purchase/retention.js";
import { Pool } from "pg";
import { purgeExpiredPrivacyRecords } from "../src/family/retention.js";
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = new Pool({
  connectionString: process.env.AMP_DATABASE_URL,
  max: 1,
});
try {
  console.log(
    JSON.stringify({
      ...(await purgeExpiredPrivacyRecords(pool)),
      expiredConsentRecords: await purgeConsentRecords(pool),
      expiredFundingRequests: await purgeExpiredFundingRequests(pool),
    }),
  );
} finally {
  await pool.end();
}
