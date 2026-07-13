// src/journey/exercises/glyphs.ts — numeral GLYPH comprehension
// (FIRST_PRINCIPLES.md: "meaning by glyph/image"). Numbers are the purest,
// most language-neutral comprehension beat: you HEAR the target number word and
// tap the universal Arabic numeral. No image pack, no L1 text — the digit IS the
// meaning, identically across all 54² pairs.
//
// Pair-agnostic by construction: the map is keyed by TARGET language. We ship
// the languages we have courses for (en now; es next), and the resolver returns
// null for anything unmapped, so a number word simply falls back to a normal
// card. NEVER assume the target is English.

import { cardRng } from "../content/rng.ts"

/** normalized target word → Arabic-numeral glyph, per target language. */
const NUMERALS: Record<string, Record<string, string>> = {
  en: {
    zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
    eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
    sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  },
  es: {
    cero: "0", uno: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5",
    seis: "6", siete: "7", ocho: "8", nueve: "9", diez: "10",
    once: "11", doce: "12", trece: "13", catorce: "14", quince: "15",
    dieciséis: "16", diecisiete: "17", dieciocho: "18", diecinueve: "19", veinte: "20",
  },
}

/** Base language subtag ("en-GB" → "en") — the numeral map is per base lang. */
function baseLang(code: string): string {
  return (code || "").split("-")[0].toLowerCase()
}

/** Strip case/punctuation/whitespace so "One" / "one." / " one " all match. */
function norm(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!¡¿?;:]/g, "")
}

/** The numeral glyph for a target-language number word, or null if the word is
 *  not a mapped number in that language. */
export function glyphForWord(targetLang: string, targetText: string): string | null {
  const table = NUMERALS[baseLang(targetLang)]
  if (!table) return null
  return table[norm(targetText)] ?? null
}

/** All numeral glyphs available for a target language (for distractor draws). */
function glyphPool(targetLang: string): string[] {
  const table = NUMERALS[baseLang(targetLang)]
  return table ? Array.from(new Set(Object.values(table))) : []
}

/**
 * Deterministically pick `n` distractor numeral glyphs ≠ the answer, biased
 * toward numerically-near values (a real "did you hear it right" test — 2 vs 3
 * beats 2 vs 17). Falls back to the wider pool if there aren't enough neighbors.
 */
export function numeralDistractors(
  targetLang: string,
  answerGlyph: string,
  cardId: string,
  n: number,
): string[] {
  const pool = glyphPool(targetLang).filter((g) => g !== answerGlyph)
  if (pool.length === 0) return []
  const ans = Number(answerGlyph)
  // sort by distance to the answer, stable, then take a seeded sample from the
  // nearest ~6 so cards vary but stay plausibly close.
  const near = [...pool].sort((a, b) => Math.abs(Number(a) - ans) - Math.abs(Number(b) - ans))
  const window = near.slice(0, Math.max(n + 3, 6))
  const rng = cardRng(`${cardId}:glyphdistractors`)
  const shuffled = [...window].sort(() => rng() - 0.5)
  return shuffled.slice(0, n)
}

/** The correct tile id — identical to ChoicePick's ANSWER_TILE_ID so the same
 *  outcome check (`id === ANSWER_TILE_ID`) works for glyph tiles too. */
export const GLYPH_ANSWER_TILE_ID = "answer"

export interface GlyphTile {
  id: string
  glyph: string
}

export interface GlyphChoiceParams {
  answerGlyph?: unknown
  glyphDistractors?: unknown
}

/**
 * Build the glyph grid: the answer numeral inserted at a seeded slot among the
 * distractor numerals. Deterministic per cardId (the same card always lays out
 * the same way). Returns [] when the payload is not a usable glyph choice
 * (no answer glyph, or zero distractors).
 */
export function buildGlyphTiles(
  params: GlyphChoiceParams | undefined,
  cardId: string,
): GlyphTile[] {
  const answer = typeof params?.answerGlyph === "string" ? params.answerGlyph : ""
  if (!answer) return []
  const rawDs = Array.isArray(params?.glyphDistractors) ? (params.glyphDistractors as unknown[]) : []
  const distractors: GlyphTile[] = []
  for (const raw of rawDs) {
    if (distractors.length >= 3) break
    const g = typeof raw === "string" ? raw : ""
    if (!g || g === answer) continue
    distractors.push({ id: `d${distractors.length}`, glyph: g })
  }
  if (distractors.length === 0) return []
  const tiles: GlyphTile[] = [...distractors]
  const insertAt = Math.floor(cardRng(cardId)() * (tiles.length + 1))
  tiles.splice(insertAt, 0, { id: GLYPH_ANSWER_TILE_ID, glyph: answer })
  return tiles
}
