// The browser's coin faces: hashed files the app's build serves (vite.config.ts
// resolves `./coin-art` here for the browser). Printing, film rendering and
// the server keep the embedded copies in coin-art.ts.
import type { CoinKind } from "../../math/scene/art";
import dime from "./coin-art/dime.webp";
import nickel from "./coin-art/nickel.webp";
import penny from "./coin-art/penny.webp";
import quarter from "./coin-art/quarter.webp";

/** The obverse of each coin as a file URL (sources: coin-art/README.md). */
export const coinFaceUrl: Record<CoinKind, string> = {
  penny,
  nickel,
  dime,
  quarter,
};
