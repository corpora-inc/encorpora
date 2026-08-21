/**
 * The blank the host writes into a prompt, and the one place this pack agrees
 * on what it looks like.
 *
 * ## Why this file exists
 *
 * The curriculum writes a blank as **U+25A1 WHITE SQUARE**, `□`. It is pinned
 * there — `dynawalla-app/src/packs/items.ts` declares `export const BLANK = "□"`
 * and its docblock says, in as many words, that it is not `___` and not `?`.
 *
 * This pack was written before that existed, when the only blank anyone had seen
 * was a literal `?`, and it looked for one with `prompt.includes("?")` and
 * `prompt.replace("?", …)`. When `dw.alg.equality.missing-addend` went active the
 * host started serving `47 + □ = 68` and **every one of those calls quietly
 * stopped matching**:
 *
 *   - the reveal substituted nothing, so a child who missed saw the card again
 *     with the box still empty — the one moment this game is held up for
 *     ("complete the sum in front of them") doing nothing at all;
 *   - the blank was never drawn in the accent, so it did not read as a blank;
 *   - `needsRegrouping` could not parse the statement, and so gave every blank
 *     item the fail-open allowance rather than a measured one.
 *
 * None of it threw. That is the whole hazard: a `String.replace` that matches
 * nothing returns the string unchanged, so the failure is a screen that looks
 * *almost* right, which is the same shape as `trebuchet` #698, `foundry` #711,
 * `lattice` #716 and `balance` #724.
 *
 * ## The accepted set
 *
 * `□`, `?` and `_` — exactly the three `games/balance/src/adapter.ts` lexes,
 * because two packs disagreeing about what a blank is would be the next version
 * of this bug. A triple underscore is deliberately NOT special-cased: one glyph
 * is the contract and the other two are tolerated history.
 */
export const BLANK = /[□?_]/u;

/** Does this prompt have a blank in it at all? */
export function hasBlank(prompt: string): boolean {
  return BLANK.test(prompt);
}

/**
 * The prompt with its blank filled in by `value`.
 *
 * Replaces the FIRST blank only, which is what the three call sites this
 * replaced did, and what every statement the host can currently write needs —
 * `drawStatement` puts at most one box on a card.
 *
 * `value` is substituted through a replacer **function** rather than a string.
 * That is not style: `String.replace` interprets `$&`, `$1` and friends inside a
 * string replacement, so an answer containing a `$` would be mangled. Answers
 * are numerals today; a function costs nothing and cannot be wrong later.
 */
export function fillBlank(prompt: string, value: string): string {
  return prompt.replace(BLANK, () => value);
}
