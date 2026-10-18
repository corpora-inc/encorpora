import { purgeOfflinePacks } from "../src/offline/retention.js";
import { purgeConsentRecords } from "../src/parent-consent/lifecycle.js";
import { purgeExpiredFundingRequests } from "../src/funding-purchase/retention.js";
import { createDatabasePool } from "../src/server/database.js";
import { purgeExpiredPrivacyRecords } from "../src/family/retention.js";
import { purgeExpiredTrials } from "../src/server/trials.js";
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  console.log(
    JSON.stringify({
      ...(await purgeExpiredPrivacyRecords(pool)),
      expiredOfflinePacks: await purgeOfflinePacks(pool),
      expiredConsentRecords: await purgeConsentRecords(pool),
      expiredFundingRequests: await purgeExpiredFundingRequests(pool),
      expiredTrials: await purgeExpiredTrials(pool),
    }),
  );
} finally {
  await pool.end();
}
