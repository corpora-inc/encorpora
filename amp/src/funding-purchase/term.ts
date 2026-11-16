import type { FundingOffer } from "./contracts.js";

/** Calendar-month anniversary, clamped to the last day of the destination month. */
export function fundedTermEnd(start: string, months: 1 | 12): string {
  const date = new Date(start);
  const index = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(index / 12);
  const month = index % 12;
  const day = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  );
  date.setUTCFullYear(year, month, day);
  return date.toISOString();
}

export const annualTermEnd = (start: string): string =>
  fundedTermEnd(start, 12);

export function isInvoiceTermPolicy(
  offer: Pick<FundingOffer, "termPolicy">,
): boolean {
  return (
    offer.termPolicy === "one-month-from-invoice" ||
    offer.termPolicy === "twelve-months-from-invoice"
  );
}

/** An issued invoice's service period is immutable, including on delayed payment. */
export function fundedInvoiceTerm(request: {
  createdAt: string;
  offer: Pick<FundingOffer, "termMonths" | "termPolicy">;
}): { startsAt: string; endsAt: string } | null {
  return isInvoiceTermPolicy(request.offer)
    ? {
        startsAt: request.createdAt,
        endsAt: fundedTermEnd(request.createdAt, request.offer.termMonths),
      }
    : null;
}
