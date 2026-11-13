/**
 * Pictures bundled with the app that a component places with an `image`
 * primitive: today, the obverse of each United States coin. A layout names
 * the picture; the renderer (web/scene/CoinFace) holds the pixels, so laying
 * out a scene stays pure and drawing one never fetches anything.
 */
export const coinKinds = ["penny", "nickel", "dime", "quarter"] as const;
export type CoinKind = (typeof coinKinds)[number];
export type SceneArt = CoinKind;
