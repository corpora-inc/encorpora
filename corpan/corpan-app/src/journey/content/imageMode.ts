// src/journey/content/imageMode.ts — the pure image-mode planner (research/
// images.md — imagepan). Decides whether an ALREADY-SCHEDULED recognition card
// (listen_pick / choice_pick) becomes a PICTURE variant when concept imagery is
// available, with NO engine/course-graph change: the runtime resolves the
// concept, calls planImageMode, and merges the returned params patch. This
// module is renderer-free + async-free ON PURPOSE, so the routing decision is
// unit-testable in isolation (mirrors faces.ts / clozeContext.ts).
//
// Picture cards are L1-free by design (research §1.1): the meaning IS the
// picture, so a missing native face is irrelevant — the picture teaches the
// word→meaning link directly. Two shapes:
//   • picture OPTIONS  — the prompt is the word (heard, or heard+read); the
//     learner taps the matching picture from a 2×2 grid (listen_image = the
//     flagship HEAR→picture beat; choice_image = the word→picture beat).
//   • picture PROMPT   — the prompt is the picture; the learner taps the target
//     WORD (image_word). Options come from the ordinary text sampler.
//
// The runtime honors `optionsAreImages`: true suppresses text-distractor
// sampling (the tiles are the concept's curated sibling pictures); false keeps
// the sampler (the tiles are words, the picture is only the prompt).

import { cardRng } from "./rng.ts"

/** The concept's picture payload the resolver yields (resolve.ts concept
 *  extras), normalized to exactly what the planner needs. */
export interface ConceptImagery {
  /** corpan-pack:// URL of the concept's own picture. */
  imageSrc: string
  /** Disambiguating sense gloss ("bank (money)") — an a11y label, never shown. */
  senseGloss?: string
  /** Curated visually-confusable siblings that each shipped a picture — the
   *  picture-choice OPTION pool. Empty ⇒ only a PICTURE PROMPT is possible. */
  distractors: { key: string; word: string; imageSrc: string }[]
}

export type ImageVariant = "listen_image" | "choice_image" | "image_word" | "intro_image"

export interface ImageModePlan {
  variant: ImageVariant
  /** Params patch merged onto spec.params (media flags + picture URLs). */
  params: Record<string, unknown>
  /** The tap targets are pictures (from the sibling pool) → the runtime
   *  suppresses text-distractor sampling. False = tiles stay WORDS (the picture
   *  is only the PROMPT) and the text sampler runs as usual. */
  optionsAreImages: boolean
}

// Deterministic shares (per specId, via cardRng). A share is a DIAL, not a gate:
// the rest of the eligible cards stay text so the learner still meets the
// written word / hears-and-reads it.
export const IMAGE_LISTEN_SHARE = 0.7 // listen_pick → HEAR → pick the picture
export const IMAGE_CHOICE_SHARE = 0.6 // first-exposure choice_pick → a picture card
/** Among image-eligible choice_pick cards, the split between a PICTURE PROMPT
 *  (image → pick the word) and PICTURE OPTIONS (word → pick the picture). */
export const IMAGE_PROMPT_SHARE = 0.5

function imageOptionParams(concept: ConceptImagery): Record<string, unknown> {
  return {
    media: "image",
    answerImageSrc: concept.imageSrc,
    imageDistractors: concept.distractors,
    answerAlt: concept.senseGloss ?? "",
    // Picture options are language-neutral — there is no prompt/answer direction.
    direction: "targetOnly",
  }
}

function imagePromptParams(concept: ConceptImagery): Record<string, unknown> {
  return {
    media: "image",
    imagePrompt: true,
    promptImageSrc: concept.imageSrc,
    promptAlt: concept.senseGloss ?? "",
    // See the picture, pick the target word.
    direction: "toTarget",
  }
}

/**
 * Decide the picture variant (or null = stay text) for a recognition card.
 * Deterministic in `specId` so a card's identity is stable across re-maps.
 * Returns null whenever imagery is absent, the card is a probe, or the roll
 * lands outside the variant's share — the caller then keeps the text form.
 */
export function planImageMode(input: {
  activityType: string
  /** EngineCard pool — pictures upgrade WORD-choice only at first exposure. */
  pool: string
  isProbe: boolean
  specId: string
  concept: ConceptImagery | null
}): ImageModePlan | null {
  const { activityType, pool, isProbe, specId, concept } = input
  if (!concept || isProbe) return null
  // §3.3 floor: a picture-OPTION card needs ≥1 sibling picture (≥2 total tiles).
  const hasImageOptions = concept.distractors.length >= 1

  // HEAR → pick the picture (the flagship). A pure comprehension beat that fits
  // the listen_pick slot on EVERY rep, not only debuts.
  if (activityType === "listen_pick") {
    if (!hasImageOptions) return null
    if (cardRng(`${specId}:imglisten`)() >= IMAGE_LISTEN_SHARE) return null
    return { variant: "listen_image", params: imageOptionParams(concept), optionsAreImages: true }
  }

  // intro_echo — the WORD DEBUT becomes a HEAR→tap-the-picture comprehension
  // beat when the concept ships sibling pictures. Like listen_image, but with NO
  // share gate: a first exposure should be interactive (tap the meaning)
  // whenever imagery allows, not a passive show-and-tell. Falls back (null) to
  // the passive picture hero / native-text tiles when there are no siblings to
  // offer as options. The card stays UNSCORED — the runtime keeps activityType
  // 'intro_echo' and only merges these picture params.
  if (activityType === "intro_echo") {
    if (!hasImageOptions) return null
    return { variant: "intro_image", params: imageOptionParams(concept), optionsAreImages: true }
  }

  // choice_pick — pictures are strongest at first exposure (research §1), so
  // limit the WORD-choice → picture upgrade to debuts.
  if (activityType === "choice_pick") {
    if (pool !== "new") return null
    if (cardRng(`${specId}:imgchoice`)() >= IMAGE_CHOICE_SHARE) return null
    // A picture PROMPT (image → word) needs no sibling pictures; picture OPTIONS
    // (word → picture) need ≥1 sibling. Take the prompt form when we roll it OR
    // when there simply are no sibling pictures to offer as options.
    const wantPrompt = !hasImageOptions || cardRng(`${specId}:imgprompt`)() < IMAGE_PROMPT_SHARE
    return wantPrompt
      ? { variant: "image_word", params: imagePromptParams(concept), optionsAreImages: false }
      : { variant: "choice_image", params: imageOptionParams(concept), optionsAreImages: true }
  }

  return null
}
