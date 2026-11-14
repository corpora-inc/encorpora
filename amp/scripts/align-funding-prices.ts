/** Prepare a private replacement offers file. Never edits the input or deploys.
 *   tsx scripts/align-funding-prices.ts /private/current.json /private/next.json
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { fundingOfferSchema } from "../src/funding-purchase/contracts.js";
import {
  programAnnualPriceMinor,
  programMonthlyPriceMinor,
} from "../src/funding-purchase/program-prices.js";
const [input, output] = process.argv.slice(2);
if (!input || !output || resolve(input) === resolve(output))
  throw new Error("Provide distinct private input and output paths");
const metadata = await stat(input);
if (!metadata.isFile() || metadata.size > 524288)
  throw new Error("Offers file must be bounded");
const offers = z
  .array(fundingOfferSchema)
  .max(200)
  .parse(JSON.parse(await readFile(input, "utf8")));
let aligned = 0;
const next = offers.map((offer) => {
  const listed = (
    offer.termMonths === 1 ? programMonthlyPriceMinor : programAnnualPriceMinor
  )[offer.programId];
  if (listed === undefined || listed === offer.subtotalMinor) return offer;
  aligned++;
  // The loader already sold this exact price, so aligning the stored value
  // preserves the live offer snapshot and does not withdraw issued invoices.
  return { ...offer, subtotalMinor: listed };
});
await writeFile(output, JSON.stringify(next, null, 2) + "\n", {
  flag: "wx",
  mode: 0o600,
});
console.log(
  `Aligned ${aligned} offers in a new private file. No deployment performed.`,
);
