// src/journey/imagePackProvision.ts
//
// Pure availability resolver for the Journey inline picture-pack offer.
// imagepan is the language-neutral concept-picture pack: once installed, the
// resolver upgrades first-exposure word choice cards to picture choices
// (runtime.ts::maybeImageChoice). We NEVER auto-download it — the inline
// ImagePackOfferBanner asks the learner first, showing the catalog `sizeMb`
// (the pack is planned to grow to thousands of images, so the size shown MUST
// come from the entry, never a hardcoded number). This module answers only "is
// there a compatible pack to offer, and which index entry is it?" — a
// side-effect-free lookup, unit-testable without a DOM or Tauri.
//
// GRACEFUL DEGRADE: no catalog / no compatible entry ⇒ null ⇒ no offer, no
// image cards, exactly today's text-only behavior.

import {
  findImagePack,
  visibleImagePacks,
  type ImagePackCatalog,
  type ImagePackCatalogEntry,
} from "../contentPacks/imagePackCatalog"

/**
 * The image-pack index entry to offer, or null when there is nothing to offer:
 * no catalog, or no app-version/channel-compatible entry. Language-neutral —
 * there is exactly one canonical imagepan id, so this takes no pair.
 */
export function matchImagePackOffer(
  catalog: ImagePackCatalog | null | undefined,
  appVersion: string,
  devMode: boolean,
): ImagePackCatalogEntry | null {
  if (!catalog) return null
  const entry = findImagePack(visibleImagePacks(catalog, appVersion, devMode))
  return entry ?? null
}
