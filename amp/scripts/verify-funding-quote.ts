import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { renderFundingQuotePdf } from "../src/funding-purchase/quote-pdf.js";
import { testFundingOffer } from "../tests/funding-purchase.fixture.js";
const directory = new URL("../artifacts/funding-review/", import.meta.url);
await mkdir(directory, { recursive: true });
const file = new URL("quote.pdf", directory).pathname;
const offer = {
  ...testFundingOffer,
  productTitle: "¡AHA! — Matemáticas",
  taxMinor: 861,
};
await writeFile(
  file,
  await renderFundingQuotePdf({
    id: "68444bca-7568-4a3f-ae47-78743116b563",
    accountId: "private-account",
    learnerId: "10720fef-40bf-4e75-8982-208b5e05f84a",
    idempotencyKey: "private-key",
    createdAt: "2026-10-17T12:00:00.000Z",
    expiresAt: "Nov 16, 2026, 12:00 PM UTC",
    status: "prepared",
    offer,
    orderId: null,
  }),
);
execFileSync("pdftotext", ["-layout", file, file + ".txt"]);
const text = await readFile(file + ".txt", "utf8");
for (const expected of [
  "¡AHA!",
  "Matemáticas",
  "UNPAID",
  "not an invoice",
  offer.merchant.legalName,
  offer.merchant.postalAddress,
  offer.merchant.supportEmail,
  offer.sku,
  "$123.00",
  "$8.61",
  "$131.61",
  "12 months",
  "Nov 16, 2026, 12:00 PM UTC",
  "10720fef-40bf-4e75-8982-208b5e05f84a",
])
  assert.ok(text.includes(expected), `Missing PDF text: ${expected}`);
assert.ok(!text.includes("private-"));
const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
assert.match(info, /Page size:\s+612 x 792 pts/);
execFileSync("pdftoppm", [
  "-scale-to",
  "1200",
  "-png",
  file,
  new URL("quote", directory).pathname,
]);
console.log(
  "Verified quote PDF text, Letter dimensions, exact subtotal/tax/total and rendered every page.",
);
