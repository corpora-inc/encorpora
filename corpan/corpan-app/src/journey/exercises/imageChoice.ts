// src/journey/exercises/imageChoice.ts — pure picture-choice tile builder
// (feed-ux §4 row 1, media:'image'; research/images.md — imagepan). Extracted
// so the seeded answer-slot insertion is unit-testable without a React renderer
// (mirrors ChoicePick's buildChoiceTiles + the clozeContext.ts pattern).
//
// Picture-choice is L1-free by design: the OPTIONS are images (meaning), so
// there is no option language and no native-face requirement — a picture teaches
// the word→meaning link directly (research §1.1). The PROMPT is the target word.

import { cardRng } from "../content/rng.ts"

/** The correct tile's id — identical to ChoicePick's ANSWER_TILE_ID so the
 *  same outcome check (`id === ANSWER_TILE_ID`) works for both text and image
 *  tiles. Kept here (not imported) to avoid a component→module→component cycle. */
export const IMAGE_ANSWER_TILE_ID = "answer"

export interface ImageTile {
  id: string
  /** corpan-pack:// URL of the picture (a local custom scheme — loads directly
   *  in an <img>, no offline-cache round-trip needed). */
  imageSrc: string
  /** Screen-reader label (the concept/sibling word). Never shown visually — the
   *  whole point is to pick by picture, not by reading a caption. */
  alt: string
}

export interface ImageChoiceParams {
  answerImageSrc?: unknown
  answerAlt?: unknown
  imageDistractors?: unknown
}

/**
 * Build the image grid: the answer picture inserted at a seeded slot among up
 * to 3 distractor pictures (→ a 2×2 grid of ≤4 tiles). Deterministic per
 * cardId (§4.5): the same card always lays out the same way. Returns [] when
 * the payload is not a usable image-choice (no answer src, or zero distractor
 * pictures) — the caller then falls back / the card was mis-emitted.
 */
export function buildImageTiles(
  params: ImageChoiceParams | undefined,
  cardId: string,
): ImageTile[] {
  const answerSrc = typeof params?.answerImageSrc === "string" ? params.answerImageSrc : ""
  if (!answerSrc) return []
  const rawDs = Array.isArray(params?.imageDistractors) ? (params.imageDistractors as unknown[]) : []
  const distractors: ImageTile[] = []
  for (const raw of rawDs) {
    if (distractors.length >= 3) break
    const d = raw as { imageSrc?: unknown; word?: unknown; key?: unknown }
    const src = typeof d?.imageSrc === "string" ? d.imageSrc : ""
    if (!src) continue
    distractors.push({ id: `d${distractors.length}`, imageSrc: src, alt: String(d?.word ?? d?.key ?? "") })
  }
  // A choice card needs ≥ 2 total options (§3.3 floor) — i.e. ≥ 1 distractor.
  if (distractors.length === 0) return []
  const answerAlt = typeof params?.answerAlt === "string" ? params.answerAlt : ""
  const tiles: ImageTile[] = [...distractors]
  const insertAt = Math.floor(cardRng(cardId)() * (tiles.length + 1))
  tiles.splice(insertAt, 0, { id: IMAGE_ANSWER_TILE_ID, imageSrc: answerSrc, alt: answerAlt })
  return tiles
}
