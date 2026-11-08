/**
 * The annual price each program's listing states, in minor units. A funded
 * offer must match its program's listing, so this is the one place a program's
 * price changes: when a program's listing or application is updated to the
 * list price (59900), change that program's line, and nothing else.
 *
 * A program listed here is sold at this price whatever `subtotalMinor` the
 * private offers file says (the loader logs when they differ). A program not
 * listed keeps the offers file's own price.
 *
 * Do not flip a program until its listing already says the new price.
 */
export const programAnnualPriceMinor: Readonly<Record<string, number>> = {
  "ar-efa": 49900,
  "az-esa": 49900,
  "nh-efa": 49900,
};
