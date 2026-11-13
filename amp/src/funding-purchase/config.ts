import { validateQuoteFonts } from "./quote-pdf.js";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { fundingPrograms } from "./programs.js";
import { programAnnualPriceMinor } from "./program-prices.js";
import { withMonthlyOffers } from "./monthly-offers.js";
import {
  fundingOfferSchema,
  availableOffers,
  type FundingOffer,
} from "./contracts.js";
/** Trusted operator file only; no supplied file means no enabled purchasing routes. */
export async function loadFundingOffers(
  path: string | undefined,
): Promise<FundingOffer[]> {
  if (!path) return [];
  const file = await stat(path);
  if (!file.isFile() || file.size > 524288)
    throw new Error("Funding offer configuration must be a bounded JSON file");
  const offers = z
    .array(fundingOfferSchema)
    .max(200)
    .parse(JSON.parse(await readFile(path, "utf8")));
  availableOffers(offers, new Date());
  // Transitional: an offer must state its refund policy. Until every offer
  // file does, the pitch and invoice make no program-specific refund promise
  // for it, and the operator is told here.
  for (const offer of offers)
    if (!offer.refundPolicy)
      console.warn(
        `Funding offer ${offer.id} has no refundPolicy; add full-to-account, purchase-to-account or none (see docs/funded-purchases.md).`,
      );
  for (const offer of offers) {
    if (fundingPrograms.get(offer.programId) !== offer.jurisdiction)
      throw new Error(
        "Funding offer references an unknown program/jurisdiction",
      );
  }
  // The program's listed price decides what the offer sells for.
  const priced = offers.map((offer) => {
    const listed = programAnnualPriceMinor[offer.programId];
    if (listed === undefined || listed === offer.subtotalMinor) return offer;
    console.warn(
      `Funding offer ${offer.id}: the offers file says ${offer.subtotalMinor} but ${offer.programId}'s listing is ${listed} (src/funding-purchase/program-prices.ts); selling at ${listed}.`,
    );
    return { ...offer, subtotalMinor: listed };
  });
  // Each funded program also sells a month at a time (monthly-offers.ts).
  const sold = withMonthlyOffers(priced);
  availableOffers(sold, new Date());
  await validateQuoteFonts(sold);
  return sold;
}
