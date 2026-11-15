// The browser's bills: hashed files the app's build serves (vite.config.ts
// resolves `./bill-art` here for the browser). Printing, film rendering and
// the server keep the embedded copies in bill-art.ts.
import type { BillValue } from "../../math/scene/art";
import five from "./bill-art/five.svg";
import one from "./bill-art/one.svg";

/** Original AMP bill drawings (bill-art/README.md) as file URLs. */
export const billFaceUrl: Record<BillValue, string> = { 1: one, 5: five };
