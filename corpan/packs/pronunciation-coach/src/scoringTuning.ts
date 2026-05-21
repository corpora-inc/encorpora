// Per-language / per-model scoring overrides. Sibling of
// `whisperTuning.ts`. Three layers, computed at `startSession` and
// passed to the native plugin via `startSession({ scoringParams })`:
//
//   native default ramp  ←  built-in lang profile  ←  built-in model
//                       profile  ←  user override (localStorage)
//
// Why this exists: the native plugin ships hardcoded acoustic ramps
// in `STTPlugin.swift` (`highResRamp`, `lowResRamp`, `smallModelRamp`)
// and Android `Scoring.kt`. Those ramps are calibrated for the
// average case and have already drifted between platforms. Whisper's
// per-token confidence is intrinsically different across (language,
// model size, quantization) combinations, so any one ramp gets
// English-on-Large-q8 wrong in the opposite direction from
// Telugu-on-Medium. Threading a per-(lang, model) overlay from the
// pack lets us calibrate empirically without a native rebuild per
// tweak.
//
// Invariant: every field is optional. A `nil`/`undefined` field
// means "use the native default for this slot." Sending an empty
// object is identical to not sending one at all — the native ramps
// stay in charge.

export type ScoringParams = {
  /** Per-word probability at which the avg-prob axis bottoms out
   *  (acoustic_avg = 0). Native iOS highRes default 0.40, Android 0.55. */
  avgZero?: number
  /** Per-word probability at which the avg-prob axis tops out
   *  (acoustic_avg = 1). Native iOS highRes default 0.95. */
  avgOne?: number
  /** Worst per-word probability at which the min-prob axis bottoms out. */
  minZero?: number
  /** Worst per-word probability at which the min-prob axis tops out. */
  minOne?: number
  /** Floor of the transcript axis when the transcript is a perfect
   *  match. `overall = transcript * (textFloor + (1 - textFloor) *
   *  acoustic)`. Native default 0.50 across all ramps. Lower this to
   *  make a transcript-perfect-but-sloppy attempt earn less. */
  textFloor?: number
  /** Whisper compression-ratio threshold above which `overall` is
   *  capped at 0.4. Native default 2.4 for high-resource, 3.5 for
   *  low-resource. */
  compressionThreshold?: number
}

/**
 * Per-language base scoring profile. Empty for now — we populate
 * entries empirically through the calibration loop. Keys are base
 * 2-letter ISO codes (`whisperLang(targetLang)` in game.ts).
 *
 * Languages not listed fall through entirely to the native ramps,
 * preserving today's behavior.
 */
export const BUILT_IN_SCORING_BY_LANG: Record<string, ScoringParams> = {
  // en: {},  // populated during Phase 2 calibration
}

/**
 * Per-model overlay applied on top of the language profile. Keys
 * are case-insensitive substrings matched against the model folder
 * (e.g. "ggml-large-v3-q8" matches both `ggml-large-v3-q8_0.bin` and
 * the Turbo q8 variant). First match wins (iteration order is
 * insertion order). Empty for now.
 *
 * Use this when a tweak generalizes across multiple languages on
 * the same model — e.g. raising `avgZero` for `large-v3-q8` because
 * its quantization makes per-word probs uniformly higher than fp16
 * Large.
 */
export const BUILT_IN_SCORING_BY_MODEL: Record<string, ScoringParams> = {
  // "ggml-large-v3-q8": {},  // populated during Phase 2 calibration
}

const STORAGE_KEY = "pc:scoring-tuning"

/**
 * User overrides shape:
 *
 *   { lang: { default?: ScoringParams, byModel?: { folderSubstr: ScoringParams } } }
 *
 * Mirrors the lookup order: lang default, then model overlay. Both
 * optional.
 */
type LangUserOverrides = {
  default?: ScoringParams
  byModel?: Record<string, ScoringParams>
}
type UserOverridesShape = Record<string, LangUserOverrides>

const loadUserScoringOverrides = (): UserOverridesShape => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as UserOverridesShape
  } catch (err) {
    console.error("[scoringTuning] loadUserScoringOverrides failed:", err)
    return {}
  }
}

const saveUserScoringOverrides = (overrides: UserOverridesShape): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch (err) {
    console.error("[scoringTuning] saveUserScoringOverrides failed:", err)
  }
}

export const setLangScoringOverride = (
  lang: string,
  patch: ScoringParams,
): void => {
  const all = loadUserScoringOverrides()
  const base = lang.split("-")[0].toLowerCase()
  const cur = all[base]?.default ?? {}
  const next = { ...cur, ...patch }
  for (const k of Object.keys(next) as (keyof ScoringParams)[]) {
    if (next[k] === undefined) delete next[k]
  }
  const langSlot = all[base] ?? {}
  if (Object.keys(next).length === 0) {
    delete langSlot.default
  } else {
    langSlot.default = next
  }
  if (
    !langSlot.default &&
    (!langSlot.byModel || Object.keys(langSlot.byModel).length === 0)
  ) {
    delete all[base]
  } else {
    all[base] = langSlot
  }
  saveUserScoringOverrides(all)
}

export const setLangModelScoringOverride = (
  lang: string,
  modelFolderSubstr: string,
  patch: ScoringParams,
): void => {
  const all = loadUserScoringOverrides()
  const base = lang.split("-")[0].toLowerCase()
  const key = modelFolderSubstr.toLowerCase()
  const langSlot = all[base] ?? {}
  const byModel = langSlot.byModel ?? {}
  const cur = byModel[key] ?? {}
  const next = { ...cur, ...patch }
  for (const k of Object.keys(next) as (keyof ScoringParams)[]) {
    if (next[k] === undefined) delete next[k]
  }
  if (Object.keys(next).length === 0) {
    delete byModel[key]
  } else {
    byModel[key] = next
  }
  if (Object.keys(byModel).length === 0) {
    delete langSlot.byModel
  } else {
    langSlot.byModel = byModel
  }
  if (
    !langSlot.default &&
    (!langSlot.byModel || Object.keys(langSlot.byModel).length === 0)
  ) {
    delete all[base]
  } else {
    all[base] = langSlot
  }
  saveUserScoringOverrides(all)
}

export const resetLangScoring = (lang: string): void => {
  const all = loadUserScoringOverrides()
  const base = lang.split("-")[0].toLowerCase()
  delete all[base]
  saveUserScoringOverrides(all)
}

export const resetAllScoring = (): void => {
  saveUserScoringOverrides({})
}

const pickModelOverlay = (
  overlays: Record<string, ScoringParams>,
  modelFolder: string | undefined,
): ScoringParams => {
  if (!modelFolder) return {}
  const f = modelFolder.toLowerCase()
  for (const [key, params] of Object.entries(overlays)) {
    if (f.includes(key.toLowerCase())) return params
  }
  return {}
}

/**
 * Resolve effective scoring params for a (language, model) pair.
 * Lookup order, each layer overrides the previous:
 *
 *   1. BUILT_IN_SCORING_BY_LANG[base]
 *   2. BUILT_IN_SCORING_BY_MODEL[firstFolderSubstrMatch]
 *   3. user override: lang `default`
 *   4. user override: lang `byModel[firstFolderSubstrMatch]`
 *
 * Returns an empty object if every layer is empty — the native
 * plugin treats that identically to "no overrides," so callers can
 * always send the result of this function.
 *
 * `modelFolder` is optional. When undefined, only language-level
 * lookups (steps 1 and 3) apply. Multiplayer rounds today don't
 * know the model folder; they pass undefined and still get the
 * language-level profile.
 */
export const mergeScoringForLangModel = (
  lang: string,
  modelFolder: string | undefined,
): ScoringParams => {
  const base = lang.split("-")[0].toLowerCase()
  const builtInLang = BUILT_IN_SCORING_BY_LANG[base] ?? {}
  const builtInModel = pickModelOverlay(BUILT_IN_SCORING_BY_MODEL, modelFolder)
  const all = loadUserScoringOverrides()
  const userLang = all[base]?.default ?? {}
  const userModel = pickModelOverlay(all[base]?.byModel ?? {}, modelFolder)
  return { ...builtInLang, ...builtInModel, ...userLang, ...userModel }
}
