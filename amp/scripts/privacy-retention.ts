import { purgeParentFeedback } from "../src/feedback/parent-retention.js";
import { purgeMetaPurchaseContexts } from "../src/advertising/meta-context.js";
import { purgeAcquisition } from "../src/advertising/acquisition.js";
import { purgeMetaPurchaseQueue } from "../src/advertising/meta-delivery.js";
import { purgeGooglePurchaseQueue } from "../src/advertising/purchase-queue.js";
import { purgeAdvertisingPermissions } from "../src/advertising/permission.js";
import { purgeOfflinePacks } from "../src/offline/retention.js";
import { purgeConsentRecords } from "../src/parent-consent/lifecycle.js";
import { purgeExpiredFundingRequests } from "../src/funding-purchase/retention.js";
import { createDatabasePool } from "../src/server/database.js";
import { purgeExpiredPrivacyRecords } from "../src/family/retention.js";
import { purgeExpiredTrials } from "../src/server/trials.js";
import { purgeFunnelEvents } from "../src/analytics/retention.js";
import { purgeProblemFlags } from "../src/feedback/retention.js";
import {
  purgeFinancialRecords,
  purgeInactiveLearners,
  purgeTrialRecords,
} from "../src/privacy/retention.js";
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  console.log(
    JSON.stringify({
      ...(await purgeExpiredPrivacyRecords(pool)),
      expiredAdvertisingPermissions: await purgeAdvertisingPermissions(pool),
      expiredAcquisitionJourneys: await purgeAcquisition(pool),
      expiredMetaPurchaseContexts: await purgeMetaPurchaseContexts(pool),
      expiredMetaPurchaseDeliveries: await purgeMetaPurchaseQueue(pool),
      expiredAdvertisingPayments: await purgeGooglePurchaseQueue(pool),
      expiredOfflinePacks: await purgeOfflinePacks(pool),
      expiredConsentRecords: await purgeConsentRecords(pool),
      expiredFundingRequests: await purgeExpiredFundingRequests(pool),
      expiredTrials: await purgeExpiredTrials(pool),
      ...(await purgeTrialRecords(pool)),
      ...(await purgeFunnelEvents(pool)),
      ...(await purgeProblemFlags(pool)),
      expiredParentFeedback: await purgeParentFeedback(pool),
      ...(await purgeInactiveLearners(pool)),
      ...(await purgeFinancialRecords(pool)),
    }),
  );
} finally {
  await pool.end();
}
