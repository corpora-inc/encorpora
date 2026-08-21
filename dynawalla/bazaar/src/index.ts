/**
 * @dynawalla/bazaar — the endless minaret-punk marketplace the games are
 * stalls in.
 *
 *   import { mountBazaar } from "@dynawalla/bazaar";
 *   import "@dynawalla/bazaar/bazaar.css";
 *
 *   const bazaar = mountBazaar(el, {
 *     stalls: [{ id: "tessera", title: "Tessera", quarter: "tilers", preview }],
 *     dayRemaining: 0.6,
 *     onEnter: (id) => router.push(`/play/${id}`),
 *     onUpgrade: () => sheet.open(),
 *   });
 *
 * The bazaar never waits for the world, and the world never waits for the
 * bazaar: nothing in here imports from the work surface or the engine.
 */

export { mountBazaar } from "./bazaar.ts";
export { QUARTERS, quarterById } from "./world/quarters.ts";
export { WARDS, WARD_ORDER, STRIPES, MATERIALS, SEMANTIC } from "./tokens/palette.ts";
export { LOCALES, STRINGS, resolveLocale } from "./strings.ts";
export { DEMO_PREVIEWS, DEMO_TITLES } from "./demo/previews.ts";
export type {
  BazaarHandle,
  BazaarOptions,
  Craft,
  Finial,
  Fold,
  PreviewFrame,
  Quarter,
  Specimen,
  StallPreview,
  StallSpec,
  StallState,
  WardId,
} from "./types.ts";
