/**
 * The annual price each funded program sells AMP at, in minor units: the
 * public list price, $599 a year, the same as a card purchase (since
 * 2026-11-12). This is the one place a program's price changes.
 *
 * A program listed here is sold at this price whatever `subtotalMinor` the
 * private offers file says (the loader logs when they differ). A program not
 * listed keeps the offers file's own price. An issued invoice's snapshot is
 * never rewritten; like any offer change, a new price withdraws one not yet
 * converted (docs/funded-purchases.md).
 */
export const programAnnualPriceMinor: Readonly<Record<string, number>> = {
  "ar-efa": 59900,
  "az-esa": 59900,
  "nh-efa": 59900,
};

/**
 * The price of one month for each program that sells AMP month to month, in
 * minor units: the public monthly price. A program listed here also sells one
 * month at a time beside its annual invoice (`withMonthlyOffers`), so a family
 * or an adult student can pay from the program account month by month.
 */
export const programMonthlyPriceMinor: Readonly<Record<string, number>> = {
  "ar-efa": 5900,
  "az-esa": 5900,
  "nh-efa": 5900,
};
