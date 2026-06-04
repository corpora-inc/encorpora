/**
 * World Plaza i18n — the chrome localization seam (LOCALIZATION_SCALE §2).
 *
 * `t(key, native, params)` resolves a chrome string into the learner's NATIVE
 * language; `isRtl`/`applyDir` orient the pack root for right-to-left natives;
 * the `make*Strings(native)` builders adapt the catalog to each surface's typed
 * strings shape. See `strings.ts` for the catalog + resolver.
 */
export {
  t,
  bindT,
  baseLocale,
  isRtl,
  dirFor,
  applyDir,
  presentLocales,
  SOURCE_EN,
  ALL_KEYS,
  type I18nKey,
  type Dict,
  type BoundT,
} from "./strings"

export {
  makeMenuStrings,
  makeTrackerStrings,
  makeSectionStrings,
  makeInterludeStrings,
} from "./surfaceStrings"

// Quest-content catalog (LOCALIZATION.md §3) — the keyed-quest-string resolver +
// key derivation. Additive: surfaces fall back to the authored literal until the
// `en` quest catalog is filled, so nothing renders blank today.
export {
  questString,
  hasQuestString,
  questTitleKey,
  questNarrativeKey,
  questStepKey,
  specialNameKey,
  presentQuestLocales,
} from "./quests"
