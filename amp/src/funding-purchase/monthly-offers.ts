import { fundingOfferSchema, type FundingOffer } from "./contracts.js";
import { programMonthlyPriceMinor } from "./program-prices.js";

/** "annual" becomes "monthly" in an identifier, or "-monthly" is added. */
const monthlyId = (value: string) =>
  /annual/.test(value)
    ? value.replace(/annual/g, "monthly")
    : `${value}-monthly`;

/**
 * Each program with a monthly price (`programMonthlyPriceMinor`) also sells
 * one month at a time: its annual named invoice, which the program reviews
 * purchase by purchase, gains a one-month sibling at that price. Everything
 * else (merchant, route, instructions, refund terms, validity) is the
 * program's own offer, so a month is invoiced and reconciled exactly like a
 * year. Deterministic, so an issued invoice's snapshot still matches its
 * offer after a restart. The annual offers keep their place first.
 *
 * Not derived: an offer approved product by product (its term approval names
 * a year), one with tax (it doesn't simply divide), text that still names a
 * year after the change, or a program whose offers file already sells a
 * month.
 */
export function withMonthlyOffers(
  offers: readonly FundingOffer[],
): FundingOffer[] {
  const derived: FundingOffer[] = [];
  for (const offer of offers) {
    const price = programMonthlyPriceMinor[offer.programId];
    if (
      price === undefined ||
      offer.termMonths !== 12 ||
      offer.purchaseReview !== "individual-approval-required" ||
      offer.documentPolicy !== "named-student-invoice" ||
      offer.taxMinor !== 0 ||
      offers.some((o) => o.programId === offer.programId && o.termMonths === 1)
    )
      continue;
    const productTitle = /\bannual\b/i.test(offer.productTitle)
      ? offer.productTitle.replace(/\bannual\b/i, (word) =>
          word[0] === "A" ? "Monthly" : "monthly",
        )
      : `${offer.productTitle} (monthly)`;
    const productDescription = offer.productDescription.replace(
      /\bone year\b/gi,
      (words) => (words[0] === "O" ? "One month" : "one month"),
    );
    if (/year|annual|12 months|twelve/i.test(productTitle + productDescription))
      continue;
    const id = monthlyId(offer.id);
    if (offers.some((o) => o.id === id)) continue;
    derived.push(
      fundingOfferSchema.parse({
        ...offer,
        id,
        sku: monthlyId(offer.sku),
        productTitle,
        productDescription,
        subtotalMinor: price,
        termMonths: 1,
        termPolicy: "one-month-from-verified-provisioning",
      }),
    );
  }
  return [...offers, ...derived];
}
