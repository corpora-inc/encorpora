/**
 * Bundled money art placed by component-only image primitives. The layout
 * names a coin or bill; CoinFace and BillFace hold the art, so laying out a
 * scene stays pure and drawing one never fetches anything.
 */
export const coinKinds = ["penny", "nickel", "dime", "quarter"] as const;
export type CoinKind = (typeof coinKinds)[number];
export type SceneArt = CoinKind;

export const billValues = [1, 5] as const;
export type BillValue = (typeof billValues)[number];
/** All US notes have the same proportions, independent of denomination. */
export const BILL_ASPECT = 6.14 / 2.61;
