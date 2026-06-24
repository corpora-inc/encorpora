/**
 * segment.ts — script-aware phrase segmentation + per-script font fallbacks.
 *
 * The single source of truth for turning a target-language phrase into the
 * ORDERED catchable units Lingo Hero drops as notes. A whitespace split only
 * works for space-delimited scripts (Latin/Cyrillic/Greek); it yields ZERO
 * playable units for no-space scripts (CJK, Thai, …), which is why Chinese,
 * Japanese and Thai were completely broken (issue #463).
 *
 * Strategy (all OFFLINE, built-in `Intl.Segmenter`, iOS 14.5+ / all modern
 * engines):
 *   - Space-delimited (Latin/Cyrillic/Greek): word granularity, filtered to
 *     word-like segments (≈ the old whitespace behavior, but punctuation-aware).
 *   - CJK no-space (zh, ja): word granularity → meaningful multi-char units;
 *     a segment that is one giant run (the segmenter occasionally returns the
 *     whole phrase) falls back to per-CHARACTER so it's always playable.
 *   - Thai + SE Asian no-space (th, lo, km, my): word granularity, and the
 *     per-character fallback is GRAPHEME-cluster-safe so a Thai combining
 *     vowel/tone mark is never split off its base consonant.
 *   - Indic (hi, bn, ta, …): space-delimited, so word granularity works; any
 *     fallback slicing is grapheme-cluster-safe (conjuncts/matras stay intact).
 *   - Fallback when Intl.Segmenter is unavailable: split on spaces if present,
 *     else per grapheme-cluster.
 *
 * This module is intentionally dependency-free and side-effect-free so
 * beatlounge (#465) can reuse `segmentPhrase` / `scriptFontStack` verbatim.
 */

/** Languages whose script writes WITHOUT inter-word spaces. */
const NO_SPACE_LANGS = new Set([
  // CJK
  "zh",
  "zh-hans",
  "zh-hant",
  "ja",
  // Thai + mainland SE Asian Brahmic (no word spaces)
  "th",
  "lo",
  "km",
  "my",
]);

/** CJK languages where a one-character fallback unit is meaningful (a hanzi /
 *  kana is itself a catchable token when the segmenter returns a giant run). */
const CJK_LANGS = new Set(["zh", "zh-hans", "zh-hant", "ja"]);

/** RTL scripts — exported so callers share ONE source of truth. */
export const RTL_LANGS = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ug"]);

/** Normalize a BCP-47-ish code to its lowercase base + full lowercase form. */
function langKeys(lang: string): { base: string; full: string } {
  const full = (lang || "").toLowerCase();
  const base = full.split(/[-_]/)[0] || full;
  return { base, full };
}

export function isRTL(lang: string): boolean {
  const { base, full } = langKeys(lang);
  return RTL_LANGS.has(base) || RTL_LANGS.has(full);
}

function isNoSpace(lang: string): boolean {
  const { base, full } = langKeys(lang);
  return NO_SPACE_LANGS.has(base) || NO_SPACE_LANGS.has(full);
}

function isCJK(lang: string): boolean {
  const { base, full } = langKeys(lang);
  return CJK_LANGS.has(base) || CJK_LANGS.has(full);
}

/** Whether the runtime has a usable Intl.Segmenter. */
function hasSegmenter(): boolean {
  return (
    typeof Intl !== "undefined" &&
    typeof (Intl as any).Segmenter === "function"
  );
}

/** Build an Intl.Segmenter, tolerant of an unknown locale (falls back to
 *  undefined locale, which still segments by Unicode script properties). */
function makeSegmenter(
  lang: string,
  granularity: "word" | "grapheme"
): any | null {
  if (!hasSegmenter()) return null;
  const { base } = langKeys(lang);
  try {
    return new (Intl as any).Segmenter(base || undefined, { granularity });
  } catch {
    try {
      return new (Intl as any).Segmenter(undefined, { granularity });
    } catch {
      return null;
    }
  }
}

/** Split into grapheme clusters (combining marks stay attached to their base).
 *  Uses Intl.Segmenter grapheme granularity when present; otherwise a
 *  best-effort code-POINT split (still better than UTF-16 unit splitting). */
export function graphemeClusters(text: string): string[] {
  const seg = makeSegmenter("und", "grapheme");
  if (seg) {
    return [...seg.segment(text)].map((s: any) => s.segment).filter(Boolean);
  }
  // Code-point fallback: Array.from respects surrogate pairs (not combining
  // marks, but far safer than text.split("")).
  return Array.from(text);
}

/** True if a segment carries at least one letter/number (script-agnostic).
 *  Used as the word-like filter for space-delimited scripts so pure-punctuation
 *  segments ("," "—" "…") don't become catchable notes. */
function looksWordLike(s: string): boolean {
  // \p{L} letters, \p{N} numbers — across ALL scripts.
  return /[\p{L}\p{N}]/u.test(s);
}

/**
 * Segment a phrase into the ORDERED catchable units for `lang`.
 *
 * Always returns at least the trimmed whole phrase as one unit when it cannot
 * do better (never returns []), so a round is never silently empty — but for
 * every supported script it returns the natural multi-unit split.
 */
export function segmentPhrase(text: string, lang: string): string[] {
  const raw = (text || "").trim();
  if (!raw) return [];

  const seg = makeSegmenter(lang, "word");

  // ---- Path A: Intl.Segmenter available -------------------------------------
  if (seg) {
    const segments = [...seg.segment(raw)];
    const noSpace = isNoSpace(lang);

    // For no-space scripts the segmenter doesn't mark CJK runs as isWordLike
    // reliably, so we keep every non-blank segment; for space-delimited scripts
    // we filter to word-like segments (drops standalone punctuation/space).
    const units = segments
      .map((s: any) => s.segment as string)
      .map((u) => u.trim())
      .filter(Boolean)
      .filter((u) => (noSpace ? true : looksWordLike(u)));

    // CJK safety net: if word-segmentation collapsed to ONE giant run (some
    // engines return the whole phrase for short CJK), fall back to per-char so
    // the phrase is still playable as a hanzi/kana sequence (reading mode).
    if (isCJK(lang) && units.length <= 1 && [...raw].length > 1) {
      return cjkCharUnits(raw);
    }

    // Thai/SE-Asian safety net: same collapse guard, grapheme-cluster-safe.
    if (noSpace && units.length <= 1 && graphemeClusters(raw).length > 1) {
      return graphemeClusters(raw).filter((g) => g.trim());
    }

    if (units.length) return units;
    // Fall through to the no-Segmenter heuristics if filtering emptied it.
  }

  // ---- Path B: no Intl.Segmenter (or it produced nothing usable) ------------
  // Space-delimited phrase → split on whitespace.
  if (/\s/.test(raw)) {
    return raw
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean);
  }
  // No spaces → CJK gets per-character, everything else per grapheme cluster.
  if (isCJK(lang)) return cjkCharUnits(raw);
  const clusters = graphemeClusters(raw).filter((g) => g.trim());
  return clusters.length ? clusters : [raw];
}

/** Per-character CJK units (each hanzi/kana is one catchable note), built on
 *  grapheme clusters so a rare combining mark stays attached. Drops blanks. */
function cjkCharUnits(text: string): string[] {
  return graphemeClusters(text).filter((g) => g.trim());
}

// ---------------------------------------------------------------------------
// Per-script FONT fallback stacks.
// ---------------------------------------------------------------------------
//
// The neon display face (Russo One / Lato) is Latin-only, so CJK / Thai /
// Arabic / Hebrew / Devanagari render as TOFU (□□□) on the canvas AND in the
// DOM strip. Lingo Hero is fully offline (no remote fonts), so we lean on the
// platform's OWN system fonts, which DO carry these scripts on every shipping
// device (iOS/Android/macOS/Windows). We never vendor large CJK/Thai files.
//
// Each stack starts with the Latin display face (so Latin text still gets the
// branded look) then appends the most likely on-device system fonts for that
// script, ending in `sans-serif` so the OS picks something with coverage.

const FONT_LATIN = "'Russo One', 'Lingo Sans', system-ui, sans-serif";

/** System fonts that ship with the relevant script, per platform. */
const SCRIPT_FALLBACKS: Record<string, string> = {
  // CJK — Apple (PingFang/Hiragino), Android/Linux (Noto CJK), Windows (MS/Yu).
  cjk:
    "'PingFang SC', 'PingFang TC', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', " +
    "'Noto Sans CJK SC', 'Noto Sans CJK JP', 'Noto Sans SC', 'Noto Sans JP', " +
    "'Microsoft YaHei', 'Yu Gothic', 'Source Han Sans', sans-serif",
  // Thai / Lao / Khmer / Burmese. ('Noto Looped Thai/Lao' is the common Linux
  // package name; Apple ships 'Thonburi', Windows 'Leelawadee UI'.)
  thai:
    "'Thonburi', 'Noto Sans Thai', 'Noto Looped Thai', 'Leelawadee UI', " +
    "'Noto Sans Lao', 'Noto Looped Lao', 'Noto Sans Khmer', 'Noto Sans Myanmar', " +
    "sans-serif",
  // Arabic / Persian / Urdu.
  arabic:
    "'Geeza Pro', 'SF Arabic', 'Noto Sans Arabic', 'Noto Naskh Arabic', " +
    "'Noto Kufi Arabic', 'Segoe UI', 'Tahoma', sans-serif",
  // Hebrew.
  hebrew:
    "'Arial Hebrew', 'SF Hebrew', 'Noto Sans Hebrew', 'Noto Rashi Hebrew', " +
    "'Segoe UI', 'Tahoma', sans-serif",
  // Devanagari + common Indic (Hindi, Marathi, …).
  devanagari:
    "'Kohinoor Devanagari', 'Devanagari Sangam MN', 'Noto Sans Devanagari', " +
    "'Lohit Devanagari', 'Nirmala UI', sans-serif",
  // Bengali, Tamil, Telugu, etc. — broad Noto Indic net.
  indic:
    "'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans Telugu', " +
    "'Noto Sans Kannada', 'Noto Sans Malayalam', 'Noto Sans Gujarati', " +
    "'Nirmala UI', sans-serif",
};

/** Map a language code to its script-fallback bucket key (or null = Latin). */
function scriptBucket(lang: string): keyof typeof SCRIPT_FALLBACKS | null {
  const { base } = langKeys(lang);
  if (CJK_LANGS.has(base) || base === "ko") return "cjk";
  if (base === "th" || base === "lo" || base === "km" || base === "my")
    return "thai";
  if (base === "ar" || base === "fa" || base === "ur" || base === "ps")
    return "arabic";
  if (base === "he" || base === "yi") return "hebrew";
  if (base === "hi" || base === "mr" || base === "ne" || base === "sa")
    return "devanagari";
  if (
    base === "bn" ||
    base === "ta" ||
    base === "te" ||
    base === "kn" ||
    base === "ml" ||
    base === "gu" ||
    base === "pa" ||
    base === "si" ||
    base === "or"
  )
    return "indic";
  return null;
}

/**
 * The canvas/DOM font stack for `lang`: the Latin display face first (branded
 * look preserved for Latin), then the on-device system fonts that actually
 * carry the script — so non-Latin glyphs render instead of tofu, fully offline.
 */
export function scriptFontStack(lang: string): string {
  const bucket = scriptBucket(lang);
  if (!bucket) return FONT_LATIN;
  return `${FONT_LATIN}, ${SCRIPT_FALLBACKS[bucket]}`;
}
