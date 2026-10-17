import { loadFundingOffers } from "../src/funding-purchase/config.js";
import { readFile, stat } from "node:fs/promises";
import { Pool } from "pg";
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
  const pool = new Pool({ connectionString: url, max: 1 });
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
main().catch(() => {
  console.error(
    "Funded provisioning rejected. Check verified source evidence, request ownership, quoted SKU/amount, complete ordered commerce events and annual activation dates. No successful import is claimed.",
  );
  process.exitCode = 1;
});
