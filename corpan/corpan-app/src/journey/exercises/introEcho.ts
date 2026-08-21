// src/journey/exercises/introEcho.ts — pure decision logic for the interactive
// WORD-DEBUT card (IntroEcho.tsx). Extracted (like imageChoice.ts / glyphs.ts /
// faces.ts) so the mode precedence + tile building + the gentle reveal skin are
// unit-testable without a React renderer — the node --test harness cannot import
// a .tsx file, so every branch a renderer would take lives here as pure TS.
//
// The debut is a first-exposure COMPREHENSION beat: HEAR the target, TAP its
// meaning (a concept picture, a numeral glyph, or a native-gloss text tile),
// then Continue. UNSCORED + gentle: a wrong tap only REVEALS the answer — never
// a red "wrong", never a penalty (IntroEcho reports its outcome on the Continue
// press, and the engine ignores an unscored result, apply.ts §unscored). Every
// step degrades gracefully to the next, ending at a passive show-and-tell.

import { cardRng } from "../content/rng.ts"
import { buildGlyphTiles } from "./glyphs.ts"
import { buildImageTiles } from "./imageChoice.ts"

/** The answer tile id — identical to the image/glyph builders' answer ids so ONE
 *  outcome check (`id === INTRO_ANSWER_TILE_ID`) works across all three tile
 *  modes (the picture/glyph/native-text tiles all mark their answer "answer"). */
export const INTRO_ANSWER_TILE_ID = "answer"

export type IntroEchoMode = "image" | "glyph" | "text" | "passive"

/**
 * Which interactive shape the debut takes, in strict precedence order:
 *   picture options → numeral glyph → native-gloss text tiles → passive.
 * A mode only wins when its tiles actually BUILD (≥2 options), so a thin
 * concept / empty distractor pool falls straight through to the passive
 * show-and-tell (graceful degrade at every step; never a broken tile grid).
 * Takes the raw spec params (`Record<string, unknown>`) — the tile builders
 * read only the keys they need.
 */
export function introEchoMode(
  params: Record<string, unknown> | undefined,
  distractorCount: number,
  cardId: string,
): IntroEchoMode {
  if (params?.media === "image" && buildImageTiles(params, cardId).length > 0) return "image"
  if (params?.media === "glyph" && buildGlyphTiles(params, cardId).length > 0) return "glyph"
  if (distractorCount > 0) return "text"
  return "passive"
}

export interface IntroTextTile {
  id: string
  text: string
}

/**
 * Build the native-gloss text tiles: the answer's native MEANING inserted at a
 * seeded slot among the sampled distractor glosses. Deterministic per cardId
 * (§4.5 — the same card always lays out the same way). Mirrors ListenPick's
 * seeded insert, but the tiles surface the meaning (native), not the heard
 * target — the learner hears the target and taps what it means.
 */
export function buildIntroTextTiles(
  answerNativeText: string,
  distractorTexts: string[],
  cardId: string,
): IntroTextTile[] {
  const tiles: IntroTextTile[] = distractorTexts.map((text, i) => ({ id: `d${i}`, text }))
  const insertAt = Math.floor(cardRng(cardId)() * (tiles.length + 1))
  tiles.splice(insertAt, 0, { id: INTRO_ANSWER_TILE_ID, text: answerNativeText })
  return tiles
}

/**
 * The gentle reveal skin: once revealed, ONLY the answer tile lights up
 * ("correct"/green); a tapped WRONG tile stays neutral — the debut never paints
 * a red "wrong" (it is unscored + penalty-free). Nothing is adorned before the
 * reveal. Used uniformly by the picture, glyph, and native-text tile grids.
 */
export function introTileState(
  revealed: boolean,
  tileId: string,
  answerId: string = INTRO_ANSWER_TILE_ID,
): "correct" | null {
  return revealed && tileId === answerId ? "correct" : null
}
