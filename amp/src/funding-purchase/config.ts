import { validateQuoteFonts } from "./quote-pdf.js";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { fundingRegistry } from "../funding/registry.js";
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
  for (const offer of offers) {
    const program = fundingRegistry.programs.find(
      (p) => p.id === offer.programId,
    );
    if (!program || program.jurisdiction !== offer.jurisdiction)
      throw new Error(
        "Funding offer references an unknown program/jurisdiction",
      );
  }
  await validateQuoteFonts(offers);
  return offers;
}
