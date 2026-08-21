/**
 * The one line the ribbon shows when a question is finished with.
 *
 * Its own module, and not a helper inside `mount.ts`, for a reason worth keeping:
 * `mount.ts` pulls in `render/gfx.ts` and therefore `three`, so a unit test of this
 * string arithmetic would drag a WebGL stack behind it and could not run at all in
 * plain node. Pure string in, pure string out, no imports.
 */

/** Longest prompt the ribbon can hold before the equation is dropped for the bare answer. */
export const RIBBON_CHARS = 28

/**
 * The blank the host writes, `□` (U+25A1, pinned as `BLANK` in `items.ts`), with
 * `?` and `_` tolerated as `games/balance` lexes them.
 *
 * Duplicated from `games/stack/src/blank.ts` because packs do not share code today.
 * Two copies of one character class is tolerable; a third means it should become
 * `packs/shared/game-prompt`, and that is filed rather than done here.
 */
const BLANK = /[□?_]/u

/**
 * The completed sum, whenever there is one to show.
 *
 * Three cases, and the middle one is the whole reason this exists:
 *
 *   `12 + 5`          → `12 + 5 = 17`   append the relation
 *   `47 + □ = 68`     → `47 + 21 = 68`  **fill the blank in place**
 *   anything too wide → `21`            bare answer, the ribbon has no room
 *
 * This used to read `!prompt.includes("?")`, a proxy for "no relation on this card
 * yet" from when a blank was spelled `?`. The host writes `□` now, so a blank
 * statement passed the test and the ribbon rendered `47 + □ = 68 = 68`: two equals
 * signs, the box still empty, and the answer stated as though it were the total.
 *
 * `resonance-miss` uses this same line as THE REVEAL — the beat that finishes the
 * sum for a child who has just missed one — so the garbling landed on the one frame
 * that was supposed to teach something.
 *
 * Filling the blank rather than falling back to the bare answer is deliberate:
 * `47 + 21 = 68` is a sum a child can read, where `21` alone is a number with
 * nothing attached to it.
 */
export function statesAnswer(prompt: string, answer: string): string {
  if (prompt.length > RIBBON_CHARS) return answer
  if (BLANK.test(prompt)) return prompt.replace(BLANK, () => answer)
  if (prompt.includes("=")) return answer
  return `${prompt} = ${answer}`
}
