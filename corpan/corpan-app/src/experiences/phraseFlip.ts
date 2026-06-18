// src/experiences/phraseFlip.ts
//
// Phrase Flip is the built-in, pre-installed core experience (`phrase_main`).
// It isn't a downloadable catalog pack, so it has no catalog `imageUrl` — this
// module is the single source of its bundled artwork so the Home carousel,
// the "Installed" grid, and anywhere else show the SAME card art instead of the
// bare lucide fallback. The launch path stays special-cased on `PHRASE_PACK_ID`
// (App's `openPhrase`); this only adds visual identity.

import { PHRASE_PACK_ID } from "@/onboarding/bestFit"
import phraseFlipArt from "@/assets/phrase-flip.svg"

export { PHRASE_PACK_ID }

/** Bundled 16:9 card art for Phrase Flip (rendered object-cover everywhere). */
export const PHRASE_FLIP_IMAGE = phraseFlipArt
