import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createDatabasePool } from "../src/server/database.js";
import { loadFundingOffers } from "../src/funding-purchase/config.js";
import { fundingRequestRow } from "../src/funding-purchase/repository.js";
import { provisionFundingRequest } from "../src/funding-purchase/provision.js";
import { FundingPurchaseError } from "../src/funding-purchase/contracts.js";
import { canonicalCommercePayload } from "../src/commerce/ledger.js";
import {
  ClassWalletError,
  classWalletConfigSchema,
  classWalletOrderId,
  parseClassWalletReport,
  prepareClassWalletProvision,
} from "../src/funding-purchase/classwallet.js";

async function boundedFile(path: string, maximum: number) {
  const info = await stat(path);
  if (!info.isFile() || info.size > maximum)
    throw new ClassWalletError("file_bounds");
  const content = await readFile(path, "utf8");
  if (Buffer.byteLength(content) > maximum)
    throw new ClassWalletError("file_bounds");
  return content;
}
async function main() {
  const [mode, reportPath, configPath, ...extra] = process.argv.slice(2);
  if (
    !["--dry-run", "--apply"].includes(mode) ||
    !reportPath ||
    !configPath ||
    extra.length ||
    !process.env.AMP_DATABASE_URL
  )
    throw new ClassWalletError("explicit_mode_files_database_required");
  const config = classWalletConfigSchema.parse(
    JSON.parse(await boundedFile(configPath, 65536)),
  );
  const source = await boundedFile(reportPath, 2_000_000);
  const reportSha256 = createHash("sha256").update(source).digest("hex");
  const rows = parseClassWalletReport(source);
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  const offers = await loadFundingOffers(process.env.AMP_FUNDING_OFFERS_FILE);
  // Quarantine every occurrence of a repeated transaction before applying any row.
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(
      row["Transaction ID"],
      (counts.get(row["Transaction ID"]) ?? 0) + 1,
    );
  let quarantined = 0;
  try {
    for (const [index, row] of rows.entries()) {
      try {
        if (counts.get(row["Transaction ID"]) !== 1)
          throw new ClassWalletError("duplicate_report_transaction");
        if (!z.string().uuid().safeParse(row["Invoice/Quote"]).success)
          throw new ClassWalletError("invoice_mismatch");
        const result = await pool.query(
          "SELECT * FROM amp_funding_requests WHERE id=$1",
          [row["Invoice/Quote"]],
        );
        if (result.rowCount !== 1)
          throw new ClassWalletError("unknown_invoice");
        const stored = result.rows[0],
          request = fundingRequestRow(stored);
        const payload = prepareClassWalletProvision(
          row,
          request,
          config,
          new Date().toISOString(),
          stored.conversion_payload ?? undefined,
        );
        if (
          request.orderId &&
          (request.orderId !== classWalletOrderId(row["Transaction ID"]) ||
            canonicalCommercePayload(payload) !==
              canonicalCommercePayload(stored.conversion_payload))
        )
          throw new ClassWalletError("previous_payment_mismatch");
        if (mode === "--apply")
          await provisionFundingRequest(pool, payload, offers);
        console.log(
          JSON.stringify({
            row: index + 2,
            result:
              mode === "--apply" ? "provisioned" : "matched-not-provisioned",
            replay: !!request.orderId,
          }),
        );
      } catch (error) {
        quarantined++;
        const reason =
          error instanceof ClassWalletError
            ? error.message
            : error instanceof FundingPurchaseError
              ? error.code
              : "invalid_or_unavailable";
        // Never print row contents, parent names, email addresses or database errors.
        console.log(
          JSON.stringify({ row: index + 2, result: "quarantined", reason }),
        );
      }
    }
    console.log(
      JSON.stringify({ mode, reportSha256, rows: rows.length, quarantined }),
    );
    if (quarantined) process.exitCode = 2;
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "ClassWallet import rejected. Check input files, verified mapping and database configuration.",
  );
  process.exitCode = 1;
});
