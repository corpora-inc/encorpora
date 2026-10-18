import { FundingPurchaseError } from "../src/funding-purchase/contracts.js";
import { loadFundingOffers } from "../src/funding-purchase/config.js";
import { readFile, stat } from "node:fs/promises";
import { createDatabasePool } from "../src/server/database.js";
import { provisionFundingRequest } from "../src/funding-purchase/provision.js";
async function main() {
  const args = process.argv.slice(2),
    url = process.env.AMP_DATABASE_URL;
  if (args.length !== 1 || !args[0] || !url)
    throw new Error("Explicit JSON file and AMP_DATABASE_URL required");
  const info = await stat(args[0]);
  if (!info.isFile() || info.size > 65536)
    throw new Error("Bounded JSON file required");
  const input = JSON.parse(await readFile(args[0], "utf8"));
  const pool = createDatabasePool({ connectionString: url });
  try {
    console.log(
      JSON.stringify(
        await provisionFundingRequest(
          pool,
          input,
          await loadFundingOffers(process.env.AMP_FUNDING_OFFERS_FILE),
        ),
      ),
    );
  } finally {
    await pool.end();
  }
}
main().catch((error: unknown) => {
  const code =
    error instanceof FundingPurchaseError
      ? error.code
      : "invalid_or_unavailable";
  console.error(
    `Funded provisioning rejected (${code}). Check verified source evidence, request ownership, existing learning access, quoted SKU/amount, complete ordered commerce events and annual activation dates. No successful import is claimed.`,
  );
  process.exitCode = 1;
});
